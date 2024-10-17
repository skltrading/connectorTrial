import {
  PrivateExchangeConnector,
  ConnectorConfiguration,
  ConnectorGroup,
  Credential,
  Serializable,
} from "skl-shared";
import { Logger } from "../../utils/logging";
import { WebSocket } from "ws";
import { envConfig } from "../../utils/config";
import axios from "axios";
import { DeribitSideMap } from "../../index";

const logger = Logger.getInstance("deribit-private-connector");

const OrderUpdateStateMap: { [key: string]: OrderState } = {
  OPEN: "open",
  FILLED: "filled",
  CANCELLED: "cancelled",
  EXPIRED: "untriggered",
  FAILED: "rejected",
};

interface DeribitOrderStatus {
  order_id: string;
  order_state: string;
  product_id: string;
  creation_timestamp: number;
  direction: string;
  order_type: string;
  amount: number;
  average_price: number;
  price: number;
  filled_amount: number;
}

export type DeribitOrderType =
  | "limit"
  | "stop_limit"
  | "take_limit"
  | "market"
  | "stop_market"
  | "take_market"
  | "market_limit"
  | "trailing_stop";

const DeribitOrderTypeMap: { [key: string]: DeribitOrderType } = {
  Limit: "limit",
  Market: "market",
};

export class DeribitPrivateConnector implements PrivateExchangeConnector {
  public websocketUrl = "wss://deribit.com/ws/api/v2";
  public websocket: any;
  private exchangeSymbol: string;
  private sklSymbol: string;
  public restUrl = "https://www.deribit.com/api/v2";
  private pingInterval: any;

  private accessToken: string;
  private refreshToken: string;
  private tokenExpirationTimeout: any;

  // Implementation
  constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential: Credential
  ) {
    this.exchangeSymbol = getExchangeSymbol(this.group, this.config);
    this.sklSymbol = getSklSymbol(this.group, this.config);
  }

  public async connect(
    onMessage: (messages: Serializable[]) => void
  ): Promise<any> {
    const privateDeribitFeed = new Promise(async (resolve) => {
      this.websocket = new WebSocket(this.websocketUrl);

      this.websocket.on("open", async () => {
        await this.authenticate();
        this.subscribeToPrivateChannels();
        this.startPingInterval()
        resolve(true);
      });

      this.websocket.on("message", (data: string) => {
        this.handleMessage(data, onMessage);
      });

      this.websocket.on("error", (error: Error) => {
        // Handle errors
        logger.error(`WebSocket error: ${error.toString()}`);
      });

      this.websocket.on("close", () => {
        // Reconnection logic
        logger.info(`WebSocket closed`);
        setTimeout(() => {
          this.connect(onMessage);
        }, 1000);
      });
    });

    return await Promise.all([privateDeribitFeed]);
  }

  private subscribeToPrivateChannels(): void {
    const channels = [
      `user.trades.${this.exchangeSymbol}`,
      `user.orders.${this.exchangeSymbol}`,
    ];

    const subscriptionMessage = {
      method: "private/subscribe",
      params: { channels, access_token: this.accessToken },
    };
    this.websocket.send(JSON.stringify(subscriptionMessage));
  }

  public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    const orders = request.orders.map((order) => {
      const orderSide = order.side.toLowerCase();
      const endpoint = orderSide === "buy" ? "/private/buy" : "/private/sell";

      return {
        symbol: this.exchangeSymbol,
        quantity: order.size.toFixed(8),

        price: order.price ? order.price.toFixed(8) : undefined,
        side: DeribitSideMap[order.side],
        type: DeribitOrderTypeMap[order.type],
        endpoint,
      };
    });
    // Implement order batching if necessary
    const batches = this.chunkArray(orders, 20);

    const requests = batches.flatMap((batch) => {
      return batch.map((order) => {
        return this.postRequest(order.endpoint, {
          batchOrders: JSON.stringify([order]),
        });
      });
    });
    const completedBatches = await Promise.all(requests);
    if (completedBatches.some((response) => response.error)) {
      return Promise.reject(
        `At least one order in batch failed: ${JSON.stringify(
          completedBatches
        )}`
      );
    } else {
      return completedBatches;
    }
  }

  private chunkArray(array: any[], chunkSize: number): any[] {
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      results.push(array.slice(i, i + chunkSize));
    }
    return results;
  }

  public postRequest = async (endpoint: string, body: any = undefined) => {
    const self = this;
    const path = self.restUrl + endpoint;
    const bodyData = body !== undefined ? JSON.stringify(body) : "";

    const headers = {
      Authorization: `Bearer ${self.accessToken}`,
    };

    try {
      return (await axios.post(self.restUrl + path, bodyData, { headers }))
        .data;
    } catch (e) {
      logger.error(e);
    }
  };

  public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
    const endpoint = "/private/cancel_all?";
    return await this.getRequest(endpoint);
  }

  public async getCurrentActiveOrders(
    request: OpenOrdersRequest
  ): Promise<OrderStatusUpdate[]> {
    const endpoint = "private/get_open_orders";
    const response = await this.getRequest(endpoint);

    return response.map((order) => ({
      event: "OrderStatusUpdate",
      connectorType: "Deribit",
      symbol: this.sklSymbol,
      orderId: order.order_id,
      sklOrderId: order.order_id,
      state: order.order_state,
      side: DeribitSideMap[order.direction],
      price: parseFloat(order.price),
      size: parseFloat(order.amount),
      notional: parseFloat(order.price) * parseFloat(order.amount),
      filled_price: parseFloat(order.price),
      filled_size: parseFloat(order.filled_amount),
      timestamp: order.creation_timestamp,
    }));
  }

  private async getRequest(route): Promise<any> {
    const header = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };

    try {
      const result = await axios.get(`${this.restUrl}${route}?`, {
        headers: header,
      });

      return result.data;
    } catch (error) {
      logger.error(error);
    }
  }

  public async getBalancePercentage(
    request: BalanceRequest
  ): Promise<BalanceResponse> {
    const baseAsset = this.group.name;
    const quoteAsset = this.config.quoteAsset;

    const baseAssetEndpoint = `/private/get_account_summary?currency=${baseAsset}`;
    const quoteAssetEndpoint = `/private/get_account_summary?currency=${quoteAsset}`;
    const [baseResponse, quoteResponse] = await Promise.all([
      this.getRequest(baseAssetEndpoint),
      this.getRequest(quoteAssetEndpoint),
    ]);

    const baseBalance = baseResponse.result.balance;
    const quoteBalance = quoteResponse.result.balance;

    const baseValue = baseBalance * request.lastPrice;
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
  }

  private handleMessage(
    data: string,
    onMessage: (messages: Serializable[]) => void
  ): void {
    const message = JSON.parse(data);

    const eventType = this.getEventType(message);

    if (eventType === "OrderStatusUpdate") {
      const orders = message.params.data;
      const orderStatusUpdate = orders.map((order: DeribitOrderStatus) => {
        return this.createOrderStatusUpdate(order);
      });
      return onMessage(orderStatusUpdate);
    } else {
      logger.log(`Unhandled private connector event: ${eventType}`);
    }
  }

  private createOrderStatusUpdate(
    order: DeribitOrderStatus
  ): OrderStatusUpdate {
    const state: OrderState = OrderUpdateStateMap[order.order_state];

    const side: Side = DeribitSideMap[order.direction];

    return {
      symbol: this.sklSymbol,
      connectorType: "Deribit",
      event: "OrderStatusUpdate",
      state,
      orderId: order.order_id,
      sklOrderId: order.order_id,
      side,
      price: order.price,
      size: order.amount,
      notional: order.price * order.amount,
      filled_price: order.average_price,
      filled_size: order.filled_amount,
      timestamp: order.creation_timestamp,
    };
  }

  private getEventType(message: any): SklEvent | null {
    if (message.error) {
      logger.error(`Error message received: ${message.error}`);
      return null;
    } else if (message.event === "subscription") {
      logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
      return null;
    } else if (message.params && message.params.channel) {
      const channel = message.params.channel;

      if (channel.startsWith("user.orders.")) {
        return "OrderStatusUpdate";
      } else {
        logger.log(`Invalid channel format: ${channel}`);
      }
    }
    return null;
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      logger.info("Pinging Deribit");
      this.websocket.send(
        JSON.stringify({
          method: "public/test",
        })
      );
    }, 1000 * 15)
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public async stop(): Promise<void> {
    // Unsubscribe from channels
    const unsubscribeMessage = {
      method: "private/unsubscribe_all",
    };
    this.websocket.send(JSON.stringify(unsubscribeMessage));

    // Optionally cancel all open orders
    await this.deleteAllOrders({
      symbol: this.sklSymbol,
      event: "CancelOrdersRequest",
      timestamp: Date.now(),
      connectorType: "Deribit",
    });

    // Stop ping interval
    this.stopPingInterval();

    this.websocket.close();
  }

  async authenticate(): Promise<void> {
    const tokenData = await this.fetchTokens(); 
    this.setTokens(
      tokenData.access_token,
      tokenData.refresh_token,
    );
    this.scheduleTokenRenewal(tokenData.expires_in);
  }

  // Sets the tokens after login or refresh
  private setTokens(
    accessToken: string,
    refreshToken: string,
  ): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  // Schedules token renewal before expiration
  private scheduleTokenRenewal(expiresIn: number): void {
    // Renew 1 minute before token expiration
    const renewalTime = (expiresIn - 60) * 1000;

    // Clear any previous renewal timeout
    if (this.tokenExpirationTimeout) {
      clearTimeout(this.tokenExpirationTimeout);
    }

    if (renewalTime > 0) {
      this.tokenExpirationTimeout = setTimeout(
        () => this.renewToken(),
        renewalTime
      );
    } else {
      // If the token is already expired renew immediately
      this.renewToken();
    }
  }

  // Renews the token using the refresh token
  private async renewToken(): Promise<void> {
    if (!this.refreshToken) {
      logger.warn("No refresh token available");
    }

    try {
      const tokenData = await this.refreshAccessToken(this.refreshToken);
      this.setTokens(
        tokenData.access_token,
        tokenData.refresh_token,
      );
      this.scheduleTokenRenewal(tokenData.expires_in);
      //s Schedule the next renewal
    } catch (error) {
      logger.error(`Error renewing token:  ${error}`);
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      const path = `public/auth?client_id=${envConfig.exchangeClientID}&client_secret=${envConfig.exchangeClientSecret}&grant_type=refresh_token&refresh_token=${refreshToken}&scope=trade:read_write wallet:read_write`;
      const response = (await axios.get(this.restUrl + path)).data;
      return await response;
    } catch (e) {
      logger.error(e);
    }
  }

  private async fetchTokens(): Promise<any> {
    try {
      const path = `public/auth?client_id=${envConfig.exchangeClientID}&client_secret=${envConfig.exchangeClientSecret}&grant_type=client_credentials&scope=trade:read_write wallet:read_write`;
      const response = (await axios.get(this.restUrl + path)).data;
      return response;
    } catch (e) {
      logger.error(`error fectchingToken: ${e}`);
    }
  }
}