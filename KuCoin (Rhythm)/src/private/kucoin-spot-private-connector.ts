import WebSocket from "ws";
import axios from "axios";
import crypto from "crypto";
import {
  BulletPrivateResponse,
  PlaceOrderRequest,
  WebSocketMessage,
} from "../types";
import logger from "../logger";
import { EventEmitter } from "events";

type MessageCallback = (data: any) => void;

/**
 * KuCoin Private WebSocket Connector
 * Handles real-time market data and private account operations via WebSocket.
 */
export class KuCoinPrivateConnector {
  private apiKey: string;
  private apiSecret: string;
  private apiPassphrase: string;
  private apiBaseUrl: string;
  private wsUrl: string;
  private connection: WebSocket | null;
  private onMessageCallback: MessageCallback;
  private subscriptions: string[];
  private keepRunning: boolean;
  private reconnectInterval: number;
  private listenKeyRefreshInterval: NodeJS.Timeout | null = null;
  private listenKeyTTL: number = 60 * 60 * 1000; // 1 hour
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(
    apiKey: string,
    apiSecret: string,
    apiPassphrase: string,
    onMessageCallback: MessageCallback
  ) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiPassphrase = apiPassphrase;
    this.apiBaseUrl = "https://api.kucoin.com";
    this.wsUrl = ""; // Will be set after obtaining the token
    this.connection = null;
    this.onMessageCallback = onMessageCallback;
    this.subscriptions = [];
    this.keepRunning = true;
    this.reconnectInterval = 5000; // Initial 5 seconds
  }

  /**
   * Adds a subscription channel to the connector.
   * @param channel - The subscription topic, e.g., '/market/ticker:BTC-USDT'
   */
  public addSubscription(channel: string) {
    this.subscriptions.push(channel);
  }

  /**
   * Generates a HMAC-SHA256 signature for private requests.
   * @param endpoint - API endpoint.
   * @param method - HTTP method.
   * @param body - Request body.
   * @returns The signature and timestamp.
   */
  private generateSignature(
    endpoint: string,
    method: string,
    body: string
  ): { signature: string; timestamp: string } {
    const timestamp = Date.now().toString();
    const strToSign = timestamp + method.toUpperCase() + endpoint + body;
    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(strToSign)
      .digest("base64");

    return { signature, timestamp };
  }

  /**
   * Obtains the bullet private token required for WebSocket connection.
   * @returns An object containing instance servers and the token.
   */
  private async getBulletPrivate(): Promise<BulletPrivateResponse["data"]> {
    const endpoint = "/api/v1/bullet-private";
    const method = "POST";
    const { signature, timestamp } = this.generateSignature(
      endpoint,
      method,
      JSON.stringify({})
    );

    try {
      const response = await axios.post<BulletPrivateResponse>(
        `${this.apiBaseUrl}${endpoint}`,
        {},
        {
          headers: {
            "KC-API-KEY": this.apiKey,
            "KC-API-SIGN": signature,
            "KC-API-TIMESTAMP": timestamp,
            "KC-API-PASSPHRASE": crypto
              .createHmac("sha256", this.apiSecret)
              .update(this.apiPassphrase)
              .digest("base64"),
            "KC-API-KEY-VERSION": "3",
          },
        }
      );
      logger.info(`Obtained bullet private token`);
      return response.data.data;
    } catch (error: any) {
      logger.error(
        `Error obtaining bullet private: ${
          error.response?.data?.msg || error.message
        }`
      );
      throw error;
    }
  }

  /**
   * Establishes the WebSocket connection using the bullet private token.
   */
  public async connect() {
    if (!this.keepRunning) {
      logger.warn("Attempted to connect while connector is stopped.");
      return;
    }

    try {
      const bullet = await this.getBulletPrivate();

      if (!bullet.instanceServers || bullet.instanceServers.length === 0) {
        logger.error("No instance servers available.");
        throw new Error("No instance servers returned from bullet-private.");
      }

      const server =
        bullet.instanceServers.find(
          (server) => server.protocol === "websocket"
        ) || bullet.instanceServers[0];

      if (!server.endpoint) {
        logger.error("Selected server is missing endpoint.");
        throw new Error("Invalid server data.");
      }

      this.wsUrl = `${server.endpoint}?token=${
        bullet.token
      }&connectId=${Date.now()}&env=prod`;

      this.connection = new WebSocket(this.wsUrl);

      this.connection.on("open", async () => {
        logger.info("Private WebSocket connection opened.");
        this.reconnectAttempts = 0; // Reset reconnection attempts on successful connection
        await this.subscribe();
        this.startListenKeyRefresh();
        this.startPing();
      });

      this.connection.on("message", (data: WebSocket.Data) => {
        try {
          const parsedData: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(parsedData);
        } catch (error) {
          logger.error(`Error parsing message: ${error}`);
        }
      });

      this.connection.on("close", (code: number, reason: string) => {
        logger.warn(
          `Private WebSocket connection closed. Code: ${code}, Reason: ${reason}`
        );
        if (this.keepRunning) {
          this.attemptReconnect();
        }
      });

      this.connection.on("error", (err: Error) => {
        logger.error(`WebSocket error: ${err.message}`);
        this.connection?.close();
      });
    } catch (error) {
      logger.error(`Connection error: ${error}`);
      this.attemptReconnect();
    }
  }

  /**
   * Attempts to reconnect with exponential backoff.
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached. Giving up.");
      return;
    }

    const delay = Math.min(
      this.reconnectInterval * 2 ** this.reconnectAttempts,
      60000
    ); // Max 60 seconds
    logger.info(
      `Reconnecting in ${delay / 1000} seconds... (Attempt ${
        this.reconnectAttempts + 1
      }/${this.maxReconnectAttempts})`
    );
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Subscribes to all added channels.
   */
  private async subscribe() {
    for (const channel of this.subscriptions) {
      const subscribeMessage = {
        id: Date.now(),
        type: "subscribe",
        topic: channel,
        response: true,
      };
      this.connection?.send(JSON.stringify(subscribeMessage));
      logger.info(`Subscribed to channel: ${channel}`);
    }
  }

  /**
   * Places an order (buy/sell) via the REST API.
   * @param orderRequest - The order request containing order details.
   */
  public async placeOrder(orderRequest: PlaceOrderRequest) {
    const endpoint = "/api/v1/orders";
    const method = "POST";
    const body = JSON.stringify(orderRequest);
    const { signature, timestamp } = this.generateSignature(
      endpoint,
      method,
      body
    );

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}${endpoint}`,
        orderRequest,
        {
          headers: {
            "KC-API-KEY": this.apiKey,
            "KC-API-SIGN": signature,
            "KC-API-TIMESTAMP": timestamp,
            "KC-API-PASSPHRASE": crypto
              .createHmac("sha256", this.apiSecret)
              .update(this.apiPassphrase)
              .digest("base64"),
            "KC-API-KEY-VERSION": "3",
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.code !== "200000") {
        logger.error(`Error placing order: ${response.data.msg}`);
        throw new Error(`Error placing order: ${response.data.msg}`);
      }
      logger.info(
        `Order placed successfully: ${JSON.stringify(response.data)}`
      );
    } catch (error: any) {
      logger.error(
        `Error placing order: ${error.response?.data?.msg || error.message}`
      );
      throw error;
    }
  }

  /**
   * Cancels an order via the REST API.
   * @param orderId - The ID of the order to cancel.
   */
  public async cancelOrder(orderId: string) {
    const endpoint = `/api/v1/orders/${orderId}`;
    const method = "DELETE";
    const body = ""; // No body needed for DELETE
    const { signature, timestamp } = this.generateSignature(
      endpoint,
      method,
      body
    );

    try {
      const response = await axios.delete(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          "KC-API-KEY": this.apiKey,
          "KC-API-SIGN": signature,
          "KC-API-TIMESTAMP": timestamp,
          "KC-API-PASSPHRASE": crypto
            .createHmac("sha256", this.apiSecret)
            .update(this.apiPassphrase)
            .digest("base64"),
          "KC-API-KEY-VERSION": "3",
        },
      });

      logger.info(`Successfully canceled order with ID: ${orderId}`);
      return response.data;
    } catch (error: any) {
      logger.error(
        `Error canceling order with ID: ${orderId}: ${
          error.response?.data?.msg || error.message
        }`
      );
      throw error;
    }
  }

  /**
   * Gets the balance of a specified currency via the REST API.
   * @param currency - The currency to check the balance for (e.g., 'BTC', 'USDT').
   */
  public async getBalance(symbol: string) {
    const endpoint = `/api/v1/accounts`;
    const method = "GET";
    const body = ""; // No body needed for GET requests
    const { signature, timestamp } = this.generateSignature(
      endpoint,
      method,
      body
    );

    try {
      const response = await axios.get(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          "KC-API-KEY": this.apiKey,
          "KC-API-SIGN": signature,
          "KC-API-TIMESTAMP": timestamp,
          "KC-API-PASSPHRASE": crypto
            .createHmac("sha256", this.apiSecret)
            .update(this.apiPassphrase)
            .digest("base64"),
          "KC-API-KEY-VERSION": "3",
        },
      });

      // Check if the data contains the symbol's balance
      const balances = response.data.data;
      const balanceForSymbol = balances.find(
        (balance: any) => balance.currency === symbol
      );

      if (balanceForSymbol) {
        logger.info(
          `Balance for ${symbol}: ${JSON.stringify(balanceForSymbol)}`
        );
      } else {
        logger.info(`No balance found for ${symbol}`);
      }

      return balanceForSymbol;
    } catch (error: any) {
      logger.error(
        `Error fetching balance: ${error.response?.data?.msg || error.message}`
      );
      throw error;
    }
  }

  /**
   * Handles incoming WebSocket messages.
   * @param data - The parsed WebSocket message.
   */
  private handleMessage(data: WebSocketMessage) {
    logger.info(`Received message: ${JSON.stringify(data)}`);

    if (data.type === "message") {
      if (data.data) {
        this.onMessageCallback(data.data);
      } else {
        logger.warn(`Received message without data: ${JSON.stringify(data)}`);
      }
    } else if (data.type === "welcome") {
      logger.info("Connected to KuCoin WebSocket.");
    } else {
      logger.warn(`Unhandled message type: ${data.type}`);
    }
  }

  /**
   * Stops the WebSocket connection and cleanup.
   */
  public stop() {
    this.keepRunning = false;
    if (this.connection) {
      this.connection.close();
      logger.info("WebSocket connection closed by user.");
    }

    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
      logger.info("Stopped listen key refresh interval.");
    }
  }

  /**
   * Starts refreshing the listen key every 50 minutes.
   */
  private startListenKeyRefresh() {
    if (this.listenKeyRefreshInterval) {
      clearInterval(this.listenKeyRefreshInterval);
    }

    this.listenKeyRefreshInterval = setInterval(async () => {
      try {
        await this.connect();
        logger.info("Listen key refreshed.");
      } catch (error) {
        logger.error(`Failed to refresh listen key: ${error}`);
      }
    }, this.listenKeyTTL - 10 * 60 * 1000); // Refresh every 50 minutes
  }

  /**
   * Pings the server at regular intervals to keep the connection alive.
   */
  private startPing() {
    setInterval(() => {
      if (this.connection?.readyState === WebSocket.OPEN) {
        const pingMessage = { id: Date.now(), type: "ping" };
        this.connection.send(JSON.stringify(pingMessage));
        logger.info("Ping sent to server.");
      }
    }, 30000); // Ping every 30 seconds
  }
}
