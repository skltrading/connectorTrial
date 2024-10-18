import WebSocket from "ws";
import axios from "axios";
import { BulletResponse, WebSocketMessage } from "../types";
import logger from "../logger";

type MessageCallback = (data: any) => void;

/**
 * KuCoin Public WebSocket Connector
 * Connects to KuCoin's public WebSocket API to receive real-time market data.
 */
export class KuCoinPublicConnector {
  private apiBaseUrl: string;
  private wsUrl: string;
  private connection: WebSocket | null;
  private onMessageCallback: MessageCallback;
  private subscriptions: string[];
  private keepRunning: boolean;
  private reconnectInterval: number;
  private listenKeyRefreshInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(onMessageCallback: MessageCallback) {
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
   * Obtains the bullet public token required for WebSocket connection.
   * @returns An object containing instance servers and the token.
   */
  private async getBulletPublic(): Promise<BulletResponse["data"]> {
    const endpoint = "/api/v1/bullet-public";
    try {
      const response = await axios.post<BulletResponse>(
        `${this.apiBaseUrl}${endpoint}`
      );
      logger.info(`Obtained bullet public token.`);
      logger.info(
        `Instance Servers: ${JSON.stringify(
          response.data.data.instanceServers,
          null,
          2
        )}`
      ); // Detailed logging
      return response.data.data;
    } catch (error: any) {
      logger.error(
        `Error obtaining bullet public: ${
          error.response?.data || error.message
        }`
      );
      throw error;
    }
  }

  /**
   * Establishes the WebSocket connection using the bullet public token.
   */
  public async connect() {
    if (!this.keepRunning) {
      logger.warn("Attempted to connect while connector is stopped.");
      return;
    }

    try {
      const bullet = await this.getBulletPublic();

      if (!bullet.instanceServers || bullet.instanceServers.length === 0) {
        logger.error("No instance servers available.");
        throw new Error("No instance servers returned from bullet-public.");
      }

      // Safely find a server with 'websocket' as the protocol
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
        logger.info("Public WebSocket connection opened.");
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
          `Public WebSocket connection closed. Code: ${code}, Reason: ${reason}`
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
      logger.info("Received welcome message.");
    } else if (data.type === "ack") {
      logger.info(`Subscription acknowledged for topic: ${data.topic}`);
    } else if (data.type === "error") {
      logger.error(`Error message received: ${JSON.stringify(data)}`);
      if (data.code === 401) {
        logger.error("Invalid token. Reconnecting...");
        this.connection?.close();
      }
    } else {
      logger.warn(`Unknown event type received: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Starts a periodic ping to keep the WebSocket connection alive.
   */
  private startPing() {
    const pingInterval = 30000; // 30 seconds
    setInterval(() => {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        this.connection.ping();
        logger.info("Ping sent to keep the connection alive.");
      }
    }, pingInterval);
  }

  /**
   * Starts the listen key refresh mechanism to renew the bullet public token before expiry.
   */
  private startListenKeyRefresh() {
    if (this.listenKeyRefreshInterval)
      clearInterval(this.listenKeyRefreshInterval);
    // Refresh bullet public every 50 minutes (before the 1-hour TTL)
    const refreshInterval = 50 * 60 * 1000; // 50 minutes
    this.listenKeyRefreshInterval = setInterval(async () => {
      try {
        logger.info("Refreshing bullet public token...");
        await this.refreshBulletPublic();
        logger.info("Bullet public token refreshed successfully.");
      } catch (error) {
        logger.error(`Error refreshing bullet public: ${error}`);
      }
    }, refreshInterval);
  }

  /**
   * Refreshes the bullet public token by obtaining a new one.
   */
  private async refreshBulletPublic() {
    const bullet = await this.getBulletPublic();
    const server =
      bullet.instanceServers.find(
        (server) => server.protocol === "websocket"
      ) || bullet.instanceServers[0];

    if (!server.endpoint) {
      logger.error("Selected server is missing endpoint during refresh.");
      throw new Error("Invalid server data during token refresh.");
    }

    this.wsUrl = `${server.endpoint}?token=${
      bullet.token
    }&connectId=${Date.now()}&env=prod`;
    // Reconnect with the new token
    this.connection?.close();
    await this.connect();
  }

  /**
   * Stops the connector gracefully by closing the WebSocket connection and clearing intervals.
   */
  public async stop() {
    this.keepRunning = false;
    if (this.listenKeyRefreshInterval)
      clearInterval(this.listenKeyRefreshInterval);
    if (this.connection) {
      this.connection.close();
      logger.info("Public WebSocket connection closed gracefully.");
    }
  }
}
