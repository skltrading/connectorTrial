import {
  PublicExchangeConnector,
  ConnectorConfiguration,
  ConnectorGroup,
  Serializable,
} from "skl-shared";
import axios from "axios";
import { envConfig } from "../../utils/config";
import { Logger } from "../../utils/logging";
import { WebSocket } from "ws";
import { DeribitSideMap } from "../../index";

const logger = Logger.getInstance("deribit-public-connector");

export interface DeribitTrade {
  trade_seq: number;
  trade_id: string;
  timestamp: number;
  tick_direction: number;
  price: number;
  mark_price: number;
  instrument_name: string;
  index_price: number;
  direction: string;
  amount: number;
}

export class DeribitPublicConnector implements PublicExchangeConnector {
  // Implementation

  public websocketUrl = "wss://deribit.com/ws/api/v2";
  public restUrl = "https://www.deribit.com/api/v2";
  public websocket: any;
  private pingInterval: any;

  private exchangeSymbol: string;

  private sklSymbol: string;

  constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential?: Credential
  ) {
    this.exchangeSymbol = getExchangeSymbol(this.group, this.config);
    this.sklSymbol = getSklSymbol(this.group, this.config);
  }

  public async connect(
    onMessage: (messages: Serializable[]) => void
  ): Promise<any> {
    const publicDeribitFeed = new Promise(async (resolve) => {
      this.websocket = new WebSocket(this.websocketUrl);

      this.websocket.on("open", () => {
        this.subscribeToChannels();

        this.pingInterval = setInterval(() => {
          logger.info("Pinging Deribit");
          this.websocket.send(
            JSON.stringify({
              method: "public/test",
            })
          );
        }, 1000 * 15);
        resolve(true);
      });

      this.websocket.on("message", (data: string) => {
        this.handleMessage(data, onMessage);
      });

      this.websocket.on("error", (error: Error) => {
        // Handle errors
        logger.error(`WebSocket error: ${error.toString()}`);
      });

      this.websocket.on("close", (code, reason) => {
        logger.info(`WebSocket closed: ${code} - ${reason}`);
        setTimeout(() => {
          this.connect(onMessage);
        }, 1000); // Reconnect after 1 second
      });
    });
    return await Promise.all([publicDeribitFeed]);
  }

  private subscribeToChannels(): void {
    const channels = [
      `trades.${this.exchangeSymbol}`,
      `book.${this.exchangeSymbol}`,
      `ticker.${this.exchangeSymbol}`,
    ];

    const subscriptionMessage = {
      method: "public/subscribe",
      params: { channels },
      jsonrpc: "2.0",
      // Include authentication if required
    };
    logger.info(`Subscribing to ${channels.length} channels`);

    this.websocket.send(JSON.stringify(subscriptionMessage));
  }

  private handleMessage(
    data: string,
    onMessage: (messages: Serializable[]) => void
  ): void {
    const message = JSON.parse(data);
    const eventType = this.getEventType(message);

    if (eventType) {
      const serializableMessages = this.createSerializableEvents(
        eventType,
        message
      );
      if (serializableMessages.length > 0) {
        onMessage(serializableMessages);
      }
    } else {
      // Log unrecognized messages
      logger.warn(`No handler for message: ${JSON.stringify(data)}`);
    }
  }

  private getEventType(message: any): SklEvent | null {
    const messageData = message?.params;
    if (messageData !== undefined && messageData.channel !== undefined) {
      if (messageData.channel.split(".")[0] === "trade") {
        return "Trade";
      } else if (messageData.channel.split(".")[0] === "book") {
        return "TopOfBook";
      } else if (messageData.channel.split(".")[0] === "ticker") {
        return "Ticker";
      }
    }

    return null;
  }

  private createSerializableEvents(
    eventType: SklEvent,
    message: any
  ): Serializable[] {
    const messageData = message?.params?.data;

    switch (eventType) {
      case "Trade":
        const trades = messageData.sort(
          (a: DeribitTrade, b: DeribitTrade) => b.timestamp - a.timestamp
        );
        return trades.map((trade: DeribitTrade) => this.createTrade(trade));

      case "TopOfBook":
        return [this.createTopOfBook(messageData)];
      case "Ticker":
        return [this.createTicker(messageData)];
      default:
        return [];
    }
  }

  private createTrade(message: any): Trade {
    return {
      symbol: this.sklSymbol,
      connectorType: "Deribit",
      event: "Trade",
      price: parseFloat(message.price),
      size: parseFloat(message.amount),
      side: DeribitSideMap[message.direction],
      timestamp: new Date(message.timestamp).getTime(),
    };
  }

  private createTopOfBook(marketDepth: DeribitMarketDepth): TopOfBook {
    return {
      symbol: this.sklSymbol,
      connectorType: "Deribit",
      event: "TopOfBook",
      timestamp: marketDepth.timestamp,
      askPrice: marketDepth.asks[0].price,
      askSize: marketDepth.asks[0].amount,
      bidPrice: marketDepth.bids[0].price,
      bidSize: marketDepth.bids[0].amount,
    };
  }

  private createTicker(tickData: DeribitTicker): Ticker {
    return {
      symbol: this.sklSymbol,
      connectorType: "Deribit",
      event: "Ticker",
      lastPrice: tickData.last_price,
      timestamp: tickData.timestamp * 1000,
    };
  }

  public async stop(): Promise<void> {
    clearInterval(this.pingInterval);
    const unsubscribeMessage = {
      method: "public/unsubscribe_all",
    };
    this.websocket.send(JSON.stringify(unsubscribeMessage));
  }
}

type DeribitMarketDepthSide = "new" | "change" | "delete";

export interface DeribitMarketDepthLevel {
  action: DeribitMarketDepthSide;
  price: number;
  amount: number;
}

export interface DeribitMarketDepth {
  type: string;
  timestamp: number;
  instrument_name: string;
  change_id: number;
  bids: DeribitMarketDepthLevel[];

  asks: DeribitMarketDepthLevel[];
}

export interface DeribitTicker {
  timestamp: number;
  last_price: number;
  state: string;
  instrument_name: string;
}
