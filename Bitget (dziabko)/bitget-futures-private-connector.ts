// import {
//     ConnectorConfiguration,
//     ConnectorGroup,
//     PrivateExchangeConnector,
//     Serializable,
//     SklEvent,
//     Credential,
//     OrderState,
//     Side,
//     OrderStatusUpdate,
//     CancelOrdersRequest,
//     OpenOrdersRequest,
//     BalanceRequest,
//     BalanceResponse,
//     BatchOrdersRequest
// } from "../../types";

// import { Logger } from "../../util/logging";
import * as Types from "./types";
import CryptoJS from "crypto-js";
import axios, { AxiosStatic } from "axios";
import { WebSocket } from "ws";
import {
  getBitgetSymbol,
  BitgetInvertedSideMap,
  BitgetSideMap,
  BitgetStringSideMap,
} from "./bitget-spot";
import { getSklSymbol } from "../../util/config";
import "dotenv/config";
import { error } from "console";
// import { Serializable } from "child_process";

export interface BitgetOrderProgress {
  d: {
    s: any;
    S: any;
    i: any;
    c: any;
    p: any;
    v: any;
    ap: any;
    a: any;
    t: any;
  };
  t: string;
}

export type BitgetOrderType = "limit" | "market";

const BitgetWSOrderUpdateStateMap: { [key: string]: OrderState } = {
  "1": "Placed",
  "2": "Filled",
  "3": "PartiallyFilled",
  "4": "Cancelled",
  "5": "CancelledPartiallyFilled",
};

const BitgetOpenOrdersStateMap: { [key: string]: OrderState } = {
  NEW: "Placed",
  PARTIALLY_FILLED: "PartiallyFilled",
};

const BitgetOrderTypeMap: { [key: string]: BitgetOrderType } = {
  Limit: "limit",
  Market: "market",
};

// const logger = Logger.getInstance('Bitget-spot-private-connector')

export class BitgetFuturesPrivateConnector implements PrivateExchangeConnector {
  public connectorId: string;

  // public privateWebsocketAddress = 'wss://ws.bitget.com/spot/v1/stream';
  public privateWebsocketAddress = "wss://ws.bitget.com/v2/ws/private";

  public privateRestEndpoint = "https://api.bitget.com";
  public publicRestEndpoint = "https://api.bitget.com";

  // Keys & Passphrases necessary for websocket authentication & login
  private apiKey = process.env.API_KEY || "";
  private secretKey = process.env.SECRET_KEY || "";
  private passphrase = process.env.PASSPHRASE || "";

  public privateWSFeed: any;

  private pingInterval: any;

  private channelArguments: Types.channelRequest;

  private axios: AxiosStatic;

  private exchangeSymbol: string;

  private sklSymbol: string;

  constructor() {
    const self = this;

    // Define which channels to subscribe to
    // Currently set to SUSDT-FUTURES channel for available demo trading USDT tokens
    this.channelArguments = {
      args: [
        {
          instType: "SUSDT-FUTURES",
          channel: "account",
          coin: "default",
        },
      ],
    };

    // this.channelArguments = {
    //     args: [{
    //         instType: "SUSDT-FUTURES",
    //         channel: "orders",
    //         instId: "default"
    //     },
    //     {
    //         instType: "SUSDT-FUTURES",
    //         channel: "positions",
    //         instId: "default"
    //     }]
    // };

    this.sklSymbol = "SKL";

    self.axios = axios;
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.privateWSFeed.send("ping");
    }, 5000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async authenticate(): Promise<void> {
    // Get the server timestamp
    const timestamp = await this.getServerTimestamp();

    // Create the signature necessary for websocket header login
    const sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(timestamp + "GET" + "/user/verify", this.secretKey));
          
    //   Login header for private websocket
    const header = {
    op: "login",
    args: [
        {
        apiKey: this.apiKey,
        passphrase: this.passphrase,
        timestamp: timestamp,
        sign: sign,
        },
    ],
    };
    
    // Send the login message to the websocket
    this.privateWSFeed.send(JSON.stringify(header));

  }

  public async connect(
    onMessage: (m: Types.Serializable[]) => void,
    socket = undefined
  ): Promise<any> {
    return new Promise(async (resolve) => {

      this.privateWSFeed =
        socket || new WebSocket(this.privateWebsocketAddress);

      this.privateWSFeed.on("open", () => {
        this.startPingInterval();

        // Authenticate the websocket connection
        this.authenticate();
      });

      this.privateWSFeed.onmessage = (message: { data: any }) => {
        // PING/PONG response to keep the connection alive
        if (message.data === "pong") {
            return;
        }

        // Handle the incoming message
        this.handleMessage(message.data.toString(), onMessage);

        // Once we have successfully connected & logged into to the private WebSocket, we can subscribe to any private channel
        let bitgetSocketMessage: Types.BitgetSocketMessage = JSON.parse(message.data.toString());

        // If the message is a login response, subscribe to the private channels
        if (bitgetSocketMessage.event == "login") {

          // Once logged in, subscribe to the private channels
          const subscriptionMessage = {
            op: "subscribe",
            args: this.channelArguments.args,
          };
          this.privateWSFeed.send(JSON.stringify(subscriptionMessage));
        }
      };

      this.privateWSFeed.on("error", function error(err: any) {
        // logger.log(`WebSocket error: ${err.toString()}`);
      });

      this.privateWSFeed.on("close", (code: any, reason: any) => {
        this.stopPingInterval();
        setTimeout(() => {
          clearInterval(this.pingInterval);
          this.connect(onMessage);
        }, 1000);  // Reconnect after 1 second
      });

      if (this.privateWSFeed.__init !== undefined) {
        this.privateWSFeed.__init();
      }
    });
  }

  public async stop(request: Types.OpenOrdersRequest): Promise<void> {
    clearInterval(this.pingInterval);

    // Unsubscribe from all channels
    const unsubscribeMessage = JSON.stringify({
        op: "unsubscribe",
        args: this.channelArguments.args,
      });

    this.privateWSFeed.send(unsubscribeMessage);

    // Close all active/open orders
    let activeOrders = await this.getCurrentActiveOrders(request);
    let cancelOrders: Types.CancelOrdersRequest[] = activeOrders.map((order) => {
        return {
            symbol: order.symbol,
            productType: request.productType,
            marginCoin: order.marginCoin,
            orderId: order.orderId,
            clientOid: order.clientOid,
        }
    });
    let cancelOrderReq: Types.BatchCancelOrdersRequest = {
        orderList: cancelOrders,
    }

    // Delete all the active orders
    await this.deleteAllOrders(cancelOrderReq);

    // Stop ping interval
    this.stopPingInterval();
    this.privateWSFeed.close();
    return;
    
  }

  private handleMessage(
    data: string,
    onMessage: (messages: Types.Serializable[]) => void
  ): void {
    let message = JSON.parse(data);

    // Check if the message is a login response prior to handling message
    if (message["event"] === "login" || message["event"] === "subscribe" || message["event"] === "unsubscribe") {
      console.log("LOGIN/SUBSCRIBE SUCCESSFUL");
      return;
    }

    // If the message is an error, log error message and return
    if (message["event"] === "error") {
      console.log("ERROR: ", message["error"]);
      return;
    }

    const eventType = this.getEventType(message);

    if (eventType === "OrderStatusUpdate") {
      const orderStatusUpdate = this.createOrderStatusUpdate(eventType, message);
      onMessage([orderStatusUpdate]);
    } else if (eventType === "AllBalances") {
      const balancesUpdate = this.createBalanceUpdate(eventType, message);
      onMessage([balancesUpdate]);
    } else {
      // Handle unrecognized messages
      console.log("Unrecognizable message: ", message);
      return;
    }
  }

  private subscribeToPrivateChannels(): void {
    const subscriptionMessage = {
      op: "subscribe",
      args: this.channelArguments.args,
    };

    this.privateWSFeed.send(JSON.stringify(subscriptionMessage));
    console.log("Subscribed to channels:", this.channelArguments.args);
  }

  public async getCurrentActiveOrders(
    request: Types.OpenOrdersRequest
  ): Promise<Types.OrderStatusUpdate[]> {
    const activeOrdersResponse: Types.ActiveOrdersResponse = await this.getRequest("/api/v2/mix/order/orders-pending", request);
    console.log("ACTIVE ORDERS: ", activeOrdersResponse);

    // If no active orders, return an empty update
    if (activeOrdersResponse.data.entrustedList == null) {
        return [];
    }

    // Map the active/open orders to an array of OrderStatusUpdate
    return activeOrdersResponse.data.entrustedList.map((activeOrder) => ({
      event: "OrderStatusUpdate",
      connectorType: "Bitget",
      symbol: activeOrder.symbol,
      orderId: activeOrder.orderId,
      state: activeOrder.status,
      side: activeOrder.side,
      price: parseFloat(activeOrder.price),
      size: activeOrder.size,
      notional: parseFloat(activeOrder.price) * parseFloat(activeOrder.size),
      timestamp: activeOrder.cTime,
      clientOid: activeOrder.clientOid,
      fee: activeOrder.fee,
      priceAvg: activeOrder.priceAvg,
      status: activeOrder.status,
      force: activeOrder.force,
      totalProfits: activeOrder.totalProfits,
      marginCoin: activeOrder.marginCoin,
      marginMode: activeOrder.marginMode,
      posMode: activeOrder.posMode,
      posSide: activeOrder.posSide,
      quoteVolume: activeOrder.quoteVolume,
      leverage: activeOrder.leverage,
      enterPointSource: activeOrder.enterPointSource,
      tradeSide: activeOrder.tradeSide,
      orderType: activeOrder.orderType,
      orderSource: activeOrder.orderSource,
      presetStopSurplusPrice: activeOrder.presetStopSurplusPrice,
      presetStopLossPrice: activeOrder.presetStopLossPrice,
      reduceOnly: activeOrder.reduceOnly,
      cTime: activeOrder.cTime,
      uTime: activeOrder.uTime,
    }));
  }

  //   Getting the percentage of the available balance to the account's total equity which involves (balance, open orders, and positions)
  public async getBalancePercentage(
    request: Types.BalanceRequest
  ): Promise<Types.BalanceResponse> {
    const self = this;
    const result: Types.AccountResponse = await this.getRequest("/api/v2/mix/account/accounts", request);

    // Calculate inventoryPercentage
    const baseVal = parseFloat(result.data[0].maxTransferOut);
    const usdtValue = parseFloat(result.data[0].usdtEquity);
    const inventoryPercentage = (baseVal / usdtValue) * 100;

    return {
      event: "BalanceResponse",
      symbol: result.data[0].marginCoin,
      baseBalance: baseVal,
      inventory: inventoryPercentage,
      timestamp: result.requestTime,
    };
  }

  public async placeOrders(request: Types.BatchFuturesLimitOrdersRequest): Promise<any> {
    const self = this;
    const orders = request.orderList.map((order) => {
      return {
        symbol: request.symbol,
        productType: request.productType,
        marginCoin: request.marginCoin,
        marginMode: request.marginMode,
        price: order.price,
        size: order.size,
        side: order.side,
        orderType: order.orderType,
        force: order.force,
      };
    });

    const responses1: Promise<Types.FuturesLimitOrderResponse>[] = orders.map(
      async (order) => {
        console.log("Placing order: ", order);
        const res: Promise<Types.FuturesLimitOrderResponse> = this.postRequest(
          "/api/v2/mix/order/place-order",
          order
        );
        return res;
      }
    );
    return responses1;
  }

  public async deleteAllOrders(
    request: Types.BatchCancelOrdersRequest
  ): Promise<any> {
    const orders = request.orderList.map((order) => {
      return {
        symbol: order.symbol,
        productType: order.productType,
        marginCoin: order.marginCoin,
        orderId: order.orderId,
        clientOid: order.clientOid,
      };
    });

    // Perform a cancel-order request on each order in the batch
    const responses1: Promise<Types.FuturesLimitOrderResponse>[] = orders.map(
      async (order) => {
        console.log("Cancelling order: ", order);
        const res: Promise<Types.FuturesLimitOrderResponse> = this.postRequest(
          "/api/v2/mix/order/cancel-order",
          order
        );
        return res;
      }
    );
    return responses1;
  }

  private getEventType(message: any): Types.SklEvent | null {
    if (message.arg.channel === "account") {
      return "AllBalances";
    } else if (message.arg.channel === "orders") {
      return "OrderStatusUpdate";
    } else if (message.op === "subscription") {
      console.info(`Subscription confirmed: ${JSON.stringify(message)}`);
      return null;
    } else if (message.event === "error") {
      console.error(`Error message received: ${message.error}`);
      return null;
    }
    return null;
  }

  private createSklEvent(
    event: Types.SklEvent,
    message: any
  ): Types.Serializable[] {
    if (event === "OrderStatusUpdate") {
      return [this.createOrderStatusUpdate(event, message)];
    } else if (event === "AllBalances") {
      return [this.createBalanceUpdate(event, message)];
    } else {
      return [];
    }
  }

  private createOrderStatusUpdate(action: Types.SklEvent, order: Types.BitgetSnapshot): Types.Serializable {
    return {
      event: order.action,
      channel: order.arg.channel,
      instType: order.arg.instType,
      accBaseVolume: parseFloat(order.data[0].accBaseVolume),
      cTime: parseInt(order.data[0].cTime),
      clientOid: parseInt(order.data[0].clientOId),
      enterPointSource: order.data[0].enterPointSource,
      feeDetail: [
        {
          feeCoin: order.data[0].feeDetail[0].feeCoin,
          fee: parseFloat(order.data[0].feeDetail[0].fee),
        },
      ],
      force: order.data[0].force,
      instId: order.data[0].instId,
      leverage: parseInt(order.data[0].leverage),
      marginCoin: order.data[0].marginCoin,
      marginMode: order.data[0].marginMode,
      notionalUsd: parseFloat(order.data[0].notionalUsd),
      orderId: parseInt(order.data[0].orderId),
      orderType: order.data[0].orderType,
      posMode: order.data[0].posMode,
      posSide: order.data[0].posSide,
      price: parseFloat(order.data[0].price),
      reduceOnly: order.data[0].reduceOnly,
      side: order.data[0].side,
      size: parseFloat(order.data[0].size),
      status: order.data[0].status,
      stpMode: order.data[0].stpMode,
      tradeSide: order.data[0].tradeSide,
      uTime: parseInt(order.data[0].uTime),
    };
  }
  private createBalanceUpdate(action: Types.SklEvent, order: Types.BitgetAccountSnapshot): Types.Serializable {
    return {
      event: order.action,
      channel: order.arg.channel,
      instType: order.arg.instType,
      marginCoin: order.data[0].marginCoin,
      frozen: order.data[0].frozen,
      available: order.data[0].available,
      maxOpenPosAvailable: order.data[0].maxOpenPosAvailable,
      maxTransferOut: order.data[0].maxTransferOut,
      equity: order.data[0].equity,
      usdtEquity: order.data[0].usdtEquity,
      timestamp: order.data[0].timestamp,
    };
  }

  //   Get the serverTimestamp if possible, otherwise return the local system's timestamp
  private async getServerTimestamp(): Promise<number> {
    let result;
    try {
      // Get timestamp from server using REST API
      result = await axios.get(`${this.publicRestEndpoint}/api/v2/public/time`);
    } catch (error) {
      console.log(error);
      // Upon failed request, return local system's timestamp
      return Date.now() / 1000;
    }
    if (result.data.requestTime) {
      return result.data.requestTime;
    } else {
      return Date.now() / 1000;
    }
  }

  private jsonToQueryString(json: Record<string, any>): string {
    return Object.keys(json)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(json[key])}`
      )
      .join("&");
  }

  private async getRequest(route: string, queryParam: any): Promise<any> {
    const now = Date.now();

    // Get the server timestamp & Message for signature
    let timestamp = await this.getServerTimestamp();
    const queryString =
      queryParam !== undefined ? this.jsonToQueryString(queryParam) : "";
    const Message = timestamp + "GET" + route + "?" + queryString;
    const payload = CryptoJS.HmacSHA256(Message, this.secretKey);
    const signature = CryptoJS.enc.Base64.stringify(payload);

    const header = {
      "Content-Type": "application/json",
      "ACCESS-KEY": this.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-PASSPHRASE": this.passphrase,
      "ACCESS-TIMESTAMP": timestamp,
      local: "en-US",
    };

    try {
      const result = await this.axios.get(
        `${this.privateRestEndpoint}${route}?${queryString}`,
        {
          headers: header,
        });

      return result.data;
    } catch (error) {
      console.log(error);
    }
  }

  private async postRequest(route: string, body: any): Promise<any> {
    const now = new Date().getTime();

    // Get the server timestamp & Message for signature
    let timestamp = await this.getServerTimestamp();
    const bodyData = body !== undefined ? JSON.stringify(body) : "";
    const Message = timestamp + "POST" + route + bodyData;
    const payload = CryptoJS.HmacSHA256(Message, this.secretKey);

    // Signature calculation for header
    const signature = CryptoJS.enc.Base64.stringify(payload);

    const header = {
      "Content-Type": "application/json",
      "ACCESS-KEY": this.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-PASSPHRASE": this.passphrase,
      "ACCESS-TIMESTAMP": timestamp,
      local: "en-US",
    };

    try {
      const result = await this.axios.post(
        `${this.publicRestEndpoint}${route}`,
        bodyData,
        {
          headers: header,
        }
      );

      return result.data;
    } catch (error) {
      console.log(`POST Error: ${error}`);
    }
  }

  private chunkArray(array: string | any[], chunkSize: number): any {
    const chunks = [];

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
  }
}
