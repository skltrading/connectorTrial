import {
  ConnectorConfiguration,
  ConnectorGroup,
  Credential,
  PublicExchangeConnector,
  Serializable,
  SklEvent,
  Ticker,
  TopOfBook,
  Trade,
} from "../utils.ts";
import { getBingXSymbol } from "../bingX-spot.ts";
import { WebSocket } from "ws";
import { Logger } from "../utils.ts";
import * as zlib from "zlib";
import CryptoJS from "crypto-js";

export class BingXSpotPublicConnector implements PublicExchangeConnector {
  private websocketUrl = "wss://open-api-ws.bingx.com/market";
  private websocket: WebSocket | undefined;
  private pingInterval: any;
  private exchangeSymbol: string;
  private sklSymbol: string;
  private logger: Logger;
  private channels: any[] = [];

  constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential?: Credential
  ) {
    this.exchangeSymbol = getBingXSymbol(this.group, this.config);
    this.sklSymbol = `${this.group.name}-${this.config.quoteAsset}`;
    this.logger = new Logger(BingXSpotPublicConnector.name);
    this.channels = [
      `${this.exchangeSymbol}@ticker`, //ticker
      `${this.exchangeSymbol}@trade`, //trade
      `${this.exchangeSymbol}@bookTicker`, //Spot Best Order Book
    ];
  }
  public async connect(onMessage: (m: Serializable[]) => void): Promise<void> {
    this.websocket = new WebSocket(this.websocketUrl, {
      perMessageDeflate: true,
    });

    this.websocket.on("open", () => {
      this.logger.info("WebSocket connection established");
      this.startHeartbeat();
      this.subscribeToChannels();
    });

    this.websocket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(data, onMessage);
    });

    this.websocket.on("error", (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
    });

    this.websocket.on("close", (code: number, reason: string) => {
      this.logger.warn(`WebSocket closed: ${code} - ${reason}`);
      clearInterval(this.pingInterval);
      this.reconnect(onMessage);
    });
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        const pingMessage = { pong: Date.now().toString() };
        this.websocket.send(JSON.stringify(pingMessage));
      }
    }, 5000);
  }

  private subscribeToChannels(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.channels.forEach((channel) => {
        let subscriptionMessage = {
          id: crypto.randomUUID(),
          reqType: "sub",
          dataType: channel,
        };

        subscriptionMessage = this.signMessage(subscriptionMessage);

        this.websocket?.send(JSON.stringify(subscriptionMessage));
        this.logger.info(`Subscribed to channel: ${channel}`);
      });
    } else {
      this.logger.warn(
        "WebSocket is not open. Unable to subscribe to channels."
      );
    }
  }

  private handleMessage(
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
      if (message.ping) {
        this.sendPong(message.ping);
      } else if (message.code === 0) {
        const { dataType, data } = message;
        switch (dataType) {
          case `${this.exchangeSymbol}@bookTicker`:
            this.handleBookTicker(data, onMessage);
            break;
          case `${this.exchangeSymbol}@ticker`:
            this.handleTicker(data, onMessage);
            break;
          case `${this.exchangeSymbol}@trade`:
            this.handleTrade(data, onMessage);
            break;
          default:
            this.logger.info(`Unhandled dataType: ${dataType}`);
        }
      } else if (message.code === 100001) {
        this.logger.info(
          `signature verification failed: ${JSON.stringify(message)}`
        );
      } else if (message.code === 100202) {
        this.logger.info(`Insufficient balance: ${JSON.stringify(message)}`);
      } else if (message.code === 100204) {
        this.logger.info(`No data: ${JSON.stringify(message)}`);
      } else if (message.code === 100400) {
        this.logger.info(`Invalid parameter: ${JSON.stringify(message)}`);
      } else if (message.code === 100413) {
        this.logger.info(`Incorrect apiKey: ${JSON.stringify(message)}`);
      } else if (message.code === 100414) {
        this.logger.info(
          `The account is abnormal, please contact customer service: ${JSON.stringify(
            message
          )}`
        );
      } else if (message.code === 100421) {
        this.logger.info(
          `The current system is busy, please try again later: ${JSON.stringify(
            message
          )}`
        );
      } else if (message.code === 100440) {
        this.logger.info(
          `Order price deviates greatly from the market price: ${JSON.stringify(
            message
          )}`
        );
      } else if (message.code === 100500) {
        this.logger.info(
          `We had a problem with our server: ${JSON.stringify(message)}`
        );
      } else if (message.code === 100503) {
        this.logger.info(`Server busy: ${JSON.stringify(message)}`);
      } else {
        const eventType = this.getEventType(message);
        if (eventType) {
          const serializableMessages = this.createSklEvent(eventType, message);
          if (serializableMessages.length > 0) {
            onMessage(serializableMessages);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);
      this.logger.info(`Raw message data: ${data}`);
    }
  }
  private getEventType(message: any): SklEvent | null {
    if (message.dataType === "ticker") {
      return "Ticker";
    } else if (message.dataType === "trade") {
      return "Trade";
    } else if (message.dataType === "depth") {
      return "TopOfBook";
    }
    return null;
  }
  private createSklEvent(event: SklEvent, message: any): Serializable[] {
    switch (event) {
      case "Ticker":
        return [this.createTicker(message)];
      case "Trade":
        return [this.createTrade(message)];
      case "TopOfBook":
        return [this.createTopOfBook(message)];
      default:
        return [];
    }
  }

  private createTicker(message: any): Ticker {
    return {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "Ticker",
      lastPrice: parseFloat(message.data.lastPrice),
      timestamp: message.data.time,
    };
  }

  private createTrade(message: any): Trade {
    return {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "Trade",
      price: parseFloat(message.data.price),
      size: parseFloat(message.data.amount),
      side: message.data.side === "BUY" ? "Buy" : "Sell",
      timestamp: message.data.time,
    };
  }

  private createTopOfBook(message: any): TopOfBook {
    const bids = message.data.bids;
    const asks = message.data.asks;
    return {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "TopOfBook",
      timestamp: message.data.time,
      askPrice: parseFloat(asks[0][0]),
      askSize: parseFloat(asks[0][1]),
      bidPrice: parseFloat(bids[0][0]),
      bidSize: parseFloat(bids[0][1]),
    };
  }
  private sendPong(ping: string): void {
    if (this.websocket) {
      const pongMessage = {
        pong: ping,
        time: new Date().toISOString(),
      };
      this.websocket.send(JSON.stringify(pongMessage));
    }
  }

  private reconnect(onMessage: (m: Serializable[]) => void): void {
    setTimeout(() => {
      this.logger.info("Attempting to reconnect...");
      this.connect(onMessage).catch((error) => {
        this.logger.error(`Reconnection failed: ${error}`);
      });
    }, 5000);
  }

  public async stop(): Promise<void> {
    if (this.websocket) {
      clearInterval(this.pingInterval);
      this.unsubscribeChannels();
      this.websocket.close();
    }
  }
  private unsubscribeChannels(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.channels.forEach((channel) => {
        const unsubscriptionMessage = {
          id: crypto.randomUUID(),
          reqType: "unsub",
          dataType: channel,
        };
        this.websocket?.send(JSON.stringify(unsubscriptionMessage));
        this.logger.info(`Unsubscribed from channel: ${channel}`);
      });
    } else {
      this.logger.warn(
        "WebSocket is not open. Unable to unsubscribe from channels."
      );
    }
  }

  private signMessage(message: any): any {
    if (this.credential) {
      const timestamp = Date.now().toString();
      const parameters = this.getParameters(message, timestamp);
      const signature = this.generateSignature(parameters);

      message.timestamp = timestamp;
      message.signature = signature;
    }
    return message;
  }

  private getParameters(payload: any, timestamp: string): string {
    let parameters = "";
    for (const key in payload) {
      parameters += `${key}=${payload[key]}&`;
    }
    parameters += `timestamp=${timestamp}`;
    return parameters;
  }

  private generateSignature(parameters: string): string {
    return CryptoJS.enc.Hex.stringify(
      CryptoJS.HmacSHA256(parameters, this.credential.secret)
    );
  }

  private handleBookTicker(
    data: any,
    onMessage: (m: Serializable[]) => void
  ): void {
    const topOfBook: TopOfBook = {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "Book Ticker",
      timestamp: data.E,
      askPrice: parseFloat(data.a),
      askSize: parseFloat(data.A),
      bidPrice: parseFloat(data.b),
      bidSize: parseFloat(data.B),
    };
    onMessage([topOfBook]);
  }

  private handleTicker(
    data: any,
    onMessage: (m: Serializable[]) => void
  ): void {
    const ticker: Ticker = {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "Ticker",
      lastPrice: parseFloat(data.c),
      timestamp: data.E,
    };
    onMessage([ticker]);
  }

  private handleTrade(data: any, onMessage: (m: Serializable[]) => void): void {
    const trade: Trade = {
      symbol: this.sklSymbol,
      connectorType: "BingX",
      event: "Trade",
      price: parseFloat(data.p),
      size: parseFloat(data.q),
      side: data.m ? "Sell" : "Buy",
      timestamp: data.E,
    };
    onMessage([trade]);
  }
}
