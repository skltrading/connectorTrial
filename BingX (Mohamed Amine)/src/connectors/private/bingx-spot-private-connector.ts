import {
  ConnectorConfiguration,
  ConnectorGroup,
  Credential,
  PrivateExchangeConnector,
  Serializable,
  SklEvent,
  BalanceResponse,
  BalanceUpdate,
  OrderStatusUpdate,
} from "../utils.ts";
import { getBingXSymbol } from "../bingX-spot.ts";

import { WebSocket } from "ws";
import { Logger } from "../utils.ts";
import * as zlib from "zlib";
import axios from "axios";
import CryptoJS from "crypto-js";

export class BingXSpotPrivateConnector implements PrivateExchangeConnector {
  private exchangeSymbol: string;
  private sklSymbol: string;
  private logger: Logger;
  private host: string = "open-api.bingx.com";
  private protocol: string = "https";
  private privateWebsocketAddress: string =
    "wss://open-api-ws.bingx.com/market";
  private privateWebsocketFeed!: WebSocket;
  private privateChannels: any[] = [];
  private pingInterval!: NodeJS.Timeout | undefined;
  private privateChannelsById: { [key: string]: string } = {};

  constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential: Credential
  ) {
    this.exchangeSymbol = getBingXSymbol(this.group, this.config);
    this.sklSymbol = `${this.group.name}-${this.config.quoteAsset}`;
    this.credential = credential;
    this.logger = new Logger(BingXSpotPrivateConnector.name);
    this.privateChannels = [
      `spot.executionReport`, //Subscription order update data
      `ACCOUNT_UPDATE`, // Subscription account balance push
    ];
  }

  public async connect(onMessage: (m: Serializable[]) => void): Promise<void> {
    const listenKey = await this.getListenKey();
    this.privateWebsocketFeed = new WebSocket(
      this.privateWebsocketAddress + `?listenKey=${listenKey}`,
      {
        perMessageDeflate: true,
      }
    );

    this.privateWebsocketFeed.on("open", async () => {
      this.logger.info("Private WebSocket connection established");
      this.startHeartbeat();
      this.subscribeToPrivateChannels();
    });

    this.privateWebsocketFeed.on(
      "message",
      (data: Buffer | ArrayBuffer | Buffer[]) => {
        this.handlePrivateMessage(data, onMessage);
      }
    );

    this.privateWebsocketFeed.on("error", (error: Error) => {
      this.logger.error(`Private WebSocket error: ${error.message}`);
    });

    this.privateWebsocketFeed.on("close", (code: number, reason: string) => {
      this.logger.warn(`Private WebSocket closed: ${code} - ${reason}`);
      this.stopHeartbeat();
      this.reconnectPrivate(onMessage);
    });
  }

  public async placeOrders(request: any): Promise<any> {
    const timestamp = Date.now().toString();
    const payload = {
      data: JSON.stringify(
        request.orders.map(
          (order: {
            side: string;
            type: string;
            quantity: number;
            price: number;
            sklOrderId: string;
          }) => ({
            symbol: this.exchangeSymbol,
            side: order.side.toUpperCase(),
            type: this.mapOrderType(order.type),
            quantity: order.quantity,
            price: order.price,
            newClientOrderId: order.sklOrderId,
          })
        )
      ),
      recvWindow: "60000",
      timestamp: timestamp,
    };

    const parameters = this.getParameters(payload, timestamp);
    const signature = this.generateSignature(parameters);
    const endpoint = `/openApi/spot/v1/trade/batchOrders`;

    try {
      const response = await this.makeRequest(
        "POST",
        endpoint,
        payload,
        timestamp,
        signature
      );
      if (response.orderId) {
        response.orderId = BigInt(response.orderId).toString();
      }
      return response;
    } catch (error) {
      this.logger.error(`Error placing order: ${error}`);
      throw error;
    }
  }

  public async deleteAllOrders(): Promise<any> {
    const endpoint = "/openApi/spot/v1/trade/cancelOpenOrders";
    const timestamp = Date.now().toString();
    const payload = {
      symbol: this.exchangeSymbol,
      timestamp: timestamp,
    };
    const parameters = this.getParameters(payload, timestamp);
    const signature = this.generateSignature(parameters);

    try {
      const response = await this.makeRequest(
        "POST",
        endpoint,
        payload,
        timestamp,
        signature
      );

      return response;
    } catch (error) {
      this.logger.error(`Error deleting order: ${error}`);
      throw error;
    }
  }
  public async getCurrentActiveOrders(): Promise<Promise<OrderStatusUpdate[]>> {
    const endpoint = "/openApi/spot/v1/trade/openOrders";
    const timestamp = Date.now().toString();
    const payload = {
      symbol: this.exchangeSymbol,
      timestamp: timestamp,
    };
    const parameters = this.getParameters(payload, timestamp);
    const signature = this.generateSignature(parameters);

    try {
      const response = await this.makeRequest(
        "GET",
        endpoint,
        payload,
        timestamp,
        signature
      );
      return response.data.orders.map((order: OrderStatusUpdate) => ({
        event: "OrderStatusUpdate",
        connectorType: "Bingx",
        symbol: this.sklSymbol,
        orderId: order.orderId,
        state: this.mapOrderState(order.status),
        side: order.side,
        price: parseFloat(order.price),
        size: parseFloat(order.origQty),
        notional: parseFloat(order.price) * parseFloat(order.origQty),
        filled_price: parseFloat(order.price),
        filled_size: parseFloat(order.executedQty),
        timestamp: order.time,
      }));
    } catch (error) {
      this.logger.error(`Error getting order: ${error}`);
      throw error;
    }
  }

  public async getBalancePercentage(): Promise<BalanceResponse> {
    const endpoint = "/openApi/spot/v1/account/balance";
    const timestamp = Date.now().toString();
    const payload = {
      recvWindow: "60000",
      timestamp: timestamp,
    };
    const parameters = this.getParameters(payload, timestamp);
    const signature = this.generateSignature(parameters);

    try {
      const response = await this.makeRequest(
        "GET",
        endpoint,
        payload,
        timestamp,
        signature
      );
      const baseAsset = this.group.name;
      const quoteAsset = this.config.quoteAsset;
      const base = response.data.balances.find(
        (b: { asset: string }) => b.asset === baseAsset
      ) || {
        free: "0",
        locked: "0",
      };
      const quote = response.data.balances.find(
        (b: { asset: string }) => b.asset === quoteAsset
      ) || {
        free: "0",
        locked: "0",
      };

      const baseBalance = parseFloat(base.free) + parseFloat(base.locked);
      const quoteBalance = parseFloat(quote.free) + parseFloat(quote.locked);
      const lastPrice = (await this.ticker()).lastPrice;

      const baseValue = baseBalance * lastPrice;
      const totalValue = baseValue + quoteBalance;
      const inventoryPercentage = (baseValue / totalValue) * 100;

      return {
        event: "BalanceResponse",
        symbol: this.sklSymbol,
        baseBalance,
        quoteBalance,
        inventory: inventoryPercentage,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Error getting order: ${error}`);
      throw error;
    }
  }

  private async ticker() {
    return (
      await this.makeRequest("GET", "/openApi/spot/v1/ticker/24hr", {
        symbol: this.exchangeSymbol,
        timestamp: Date.now().toString(),
      })
    ).data[0];
  }

  private async getListenKey(): Promise<string> {
    const response = await this.makeRequest(
      "POST",
      "/openApi/user/auth/userDataStream",
      {}
    );
    return response.listenKey;
  }

  private subscribeToPrivateChannels(): void {
    if (
      this.privateWebsocketFeed &&
      this.privateWebsocketFeed.readyState === WebSocket.OPEN
    ) {
      this.privateChannels.forEach((channel) => {
        const id: string = crypto.randomUUID();
        const subscriptionMessage = {
          id: id,
          reqType: "sub",
          dataType: channel,
        };

        this.privateChannelsById[`${id}`] = channel;
        this.privateWebsocketFeed?.send(JSON.stringify(subscriptionMessage));
        this.logger.info(`Private Subscribed to channel: ${channel}/${id}`);
      });
    } else {
      this.logger.warn(
        "Private WebSocket is not open. Unable to subscribe to channels."
      );
    }
  }

  private generateSignature(parameters: string): string {
    return CryptoJS.enc.Hex.stringify(
      CryptoJS.HmacSHA256(parameters, this.credential.secret)
    );
  }

  private getParameters(
    payload: any,
    timestamp: string,
    urlEncode: boolean = false
  ): string {
    let parameters = "";
    for (const key in payload) {
      if (urlEncode) {
        parameters += `${key}=${encodeURIComponent(payload[key])}&`;
      } else {
        parameters += `${key}=${payload[key]}&`;
      }
    }
    parameters += `timestamp=${timestamp}`;
    return parameters;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (
        this.privateWebsocketFeed &&
        this.privateWebsocketFeed.readyState === WebSocket.OPEN
      ) {
        const pingMessage = { pong: Date.now().toString() };
        this.privateWebsocketFeed.send(JSON.stringify(pingMessage));
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
  
  private handlePrivateMessage(
    data: Buffer | ArrayBuffer | Buffer[],
    onMessage: (m: Serializable[]) => void
  ): void {
    try {
      const decompressedData = zlib
        .gunzipSync(
          Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
        )
        .toString();
      const message = JSON.parse(decompressedData);

      if (message.id) {
        switch (this.privateChannelsById[message.id]) {
          case "spot.executionReport":
            this.handleExecutionReport({...message}, onMessage);
            break;
          case "ACCOUNT_UPDATE":
            this.handleAccountUpdate(message, onMessage);
            break;
          default:
            this.logger.info(`Unhandled dataType: ${message.dataType}`);
        }
      } else if (message.ping) {
        this.sendPong(message.ping);
      } else if (message.code === 0) {
        this.logger.info(`${message.msg}: ${JSON.stringify(message)}`);
      } else {
        this.handleErrorCodes(message);
      }
    } catch (error) {
      this.logger.error(`Error handling private message: ${error}`);
      this.logger.info(`Raw message data: ${data}`);
    }
  }

  private handleExecutionReport(
    data: any,
    onMessage: (m: Serializable[]) => void
  ): void {
    onMessage([{event:'spot.executionReport', ...data}]);
  }

  private handleAccountUpdate(
    data: any,
    onMessage: (m: Serializable[]) => void
  ): void {
    // const balanceUpdate: BalanceUpdate = {
    //   symbol: this.sklSymbol,
    //   connectorType: "BingX",
    //   event: "BalanceUpdate",
    //   baseBalance:
    //     parseFloat(data.baseAsset.free) + parseFloat(data.baseAsset.locked),
    //   quoteBalance:
    //     parseFloat(data.quoteAsset.free) + parseFloat(data.quoteAsset.locked),
    //   timestamp: data.time,
    // };
    onMessage([{event:'ACCOUNT_UPDATE', ...data}]);
  }

  private handleErrorCodes(message: any): void {
    const errorCodes: { [key: number]: string } = {
      100001: "Signature verification failed",
      100202: "Insufficient balance",
      100204: "No data",
      100400: "Invalid parameter",
      100413: "Incorrect apiKey",
      100414: "The account is abnormal, please contact customer service",
      100421: "The current system is busy, please try again later",
      100440: "Order price deviates greatly from the market price",
      100500: "We had a problem with our server",
      100503: "Server busy",
    };

    if (message.code in errorCodes) {
      this.logger.info(
        `${errorCodes[message.code]}: ${JSON.stringify(message)}`
      );
    } else {
      this.logger.info(`Unknown error: ${JSON.stringify(message)}`);
    }
  }
  private createPrivateSerializableEvent(
    eventType: string,
    message: any
  ): Serializable[] {
    switch (eventType) {
      case "OrderUpdate":
        return [this.createOrderStatusUpdate(message)];
      case "AccountUpdate":
        return [this.createBalanceUpdate(message)];
      default:
        return [];
    }
  }

  private createOrderStatusUpdate(message: any): OrderStatusUpdate {
    return {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "OrderStatusUpdate",
      orderId: message.orderId,
      sklOrderId: message.clientOrderId,
      state: this.mapOrderState(message.status),
      side: this.mapOrderSide(message.side),
      price: parseFloat(message.price),
      size: parseFloat(message.origQty),
      notional: parseFloat(message.price) * parseFloat(message.origQty),

      filledPrice: parseFloat(message.avgPrice),
      filledSize: parseFloat(message.executedQty),
      timestamp: message.time,
    };
  }
  private createBalanceUpdate(message: any): BalanceUpdate {
    return {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "BalanceUpdate",
      baseBalance:
        parseFloat(message.baseAsset.free) +
        parseFloat(message.baseAsset.locked),
      quoteBalance:
        parseFloat(message.quoteAsset.free) +
        parseFloat(message.quoteAsset.locked),
      timestamp: message.time,
    };
  }

  private mapOrderState(bingXStatus: string): string {
    const stateMap: { [key: string]: string } = {
      NEW: "Open",
      PARTIALLY_FILLED: "PartiallyFilled",
      FILLED: "Filled",
      CANCELED: "Cancelled",
      REJECTED: "Rejected",
    };
    return stateMap[bingXStatus] || "Unknown";
  }

  private mapOrderSide(bingXSide: string): string {
    return bingXSide.toLowerCase() === "buy" ? "Buy" : "Sell";
  }

  private mapOrderType(sklOrderType: string): BingXOrderType {
    const orderTypeMap: { [key: string]: BingXOrderType } = {
      Market: BingXOrderType.MARKET,
      Limit: BingXOrderType.LIMITED,
    };
    return orderTypeMap[sklOrderType] || BingXOrderType.LIMITED;
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    params: any = {},
    timestamp: string = "",
    signature: string = ""
  ): Promise<any> {
    try {
      const url = `${this.protocol}://${this.host}${endpoint}`;
      const headers = {
        "X-BX-APIKEY": this.credential.api,
        "Content-Type": "application/json",
      };

      const fullUrl = `${url}?${this.getParameters(
        params,
        timestamp,
        true
      )}&signature=${signature}`;

      const config = {
        method: method,
        url: fullUrl,
        headers: headers,
        transformResponse: (resp: any) => {
          return resp;
        },
      };

      const response = await axios(config);

      this.logger.info(`Response status: ${response.status}`);
      this.logger.info(`Response data: ${response.data}`);

      return JSON.parse(response.data);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error making request to BingX API: ${error.message}`
        );
      } else {
        this.logger.error(
          `Error making request to BingX API: ${String(error)}`
        );
      }
      throw error;
    }
  }

  private sendPong(ping: string): void {
    if (this.privateWebsocketFeed) {
      const pongMessage = {
        pong: ping,
        time: new Date().toISOString(),
      };
      this.privateWebsocketFeed.send(JSON.stringify(pongMessage));
    }
  }



  private async reconnectPrivate(onMessage: (m: Serializable[]) => void): Promise<void> {
    this.stopHeartbeat();
    setTimeout(async () => {
      this.logger.info("Attempting to reconnect...");
      try {
        await this.connect(onMessage);
        this.subscribeToPrivateChannels();
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error}`);
        this.reconnectPrivate(onMessage);
      }
    }, 5000);
  }
  public async stop(): Promise<void> {
    this.stopHeartbeat();

    if (this.privateWebsocketFeed && this.privateWebsocketFeed.readyState === WebSocket.OPEN) {
      this.privateChannels.forEach((channel) => {
        const unsubscriptionMessage = {
          id: crypto.randomUUID(),
          reqType: "unsub",
          dataType: channel,
        };
        this.privateWebsocketFeed?.send(JSON.stringify(unsubscriptionMessage));
        this.logger.info(`Unsubscribed from channel: ${channel}`);
      });
    }

    try {
      await this.deleteAllOrders();
    } catch (error) {
      this.logger.error(`Error cancelling orders during stop: ${error}`);
    }

    if (this.privateWebsocketFeed) {
      this.privateWebsocketFeed.close();
    }
  
    this.logger.info("BingX Spot Private Connector stopped");
  }
}
enum BingXOrderType {
  MARKET = "MARKET",
  LIMITED = "LIMITED",
  TAKE_STOP_LIMIT = "TAKE_STOP_LIMIT",
  TAKE_STOP_MARKET = "TAKE_STOP_MARKET",
  TRIGGER_LIMIT = "TRIGGER_LIMIT",
  TRIGGER_MARKET = "TRIGGER_MARKET",
}
