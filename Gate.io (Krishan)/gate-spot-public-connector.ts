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
} from "../../types";
import {
    getGateSymbol,
    GateTradeSide,
    GateSideMap,
} from './gate-spot';
import { WebSocket } from 'ws';
import { Logger } from "../../util/logging";
// import CryptoJS from "crypto-js";
// import * as jwt from 'jsonwebtoken';
// import * as crypto from 'crypto';
import { getSklSymbol } from "../../util/config";

const logger = Logger.getInstance('gate-spot-public-connector');


export interface GateTrade {
    id: number;                    // Trade ID
    create_time: number;           // Trade Unix timestamp in seconds
    create_time_ms: string;        // Trading Unix timestamp in milliseconds
    side: GateTradeSide;          // Taker side (buy/sell)
    currency_pair: string;         // Currency pair (e.g., BTC_USDT)
    amount: string;                  // Trade size (amount)
    price: string;                 // Trade price
    range: string;                 // Trade range (format: "start-end")
}

export interface GateTicker {
    currency_pair: string;  // e.g., BTC_USDT
    last: string;           // Last traded price
    lowest_ask: string;     // Lowest ask price
    highest_bid: string;    // Highest bid price
    change_percentage: string;  // Price change percentage over the last 24 hours
    base_volume: string;    // Volume of the base currency
    quote_volume: string;   // Volume of the quote currency
    high_24h: string;       // 24-hour high price
    low_24h: string;        // 24-hour low price
}

interface GateOrderBookLevel {
    price_level: string;  // Price level of the order
    new_quantity: string; // Quantity at that price level
}

interface GateOrderBookUpdate {
    t: number;  // Order book update time in milliseconds
    s: string;  // Currency pair
    U: number;  // First update order book id
    u: number;  // Last update order book id
    b: [string, string][];  // Array of bids [Price, Amount]
    a: [string, string][];  // Array of asks [Price, Amount]
}

// Utility function to map event types
const getEventType = (message: any): SklEvent | null => {
    if (message.channel === 'spot.order_book_update') {
        return 'TopOfBook';
    } else if (message.channel === 'spot.trades') {
        return 'Trade';
    } else if (message.channel === 'spot.tickers') {
        return 'Ticker';
    }
    return null;
};

export class GateSpotPublicConnector implements PublicExchangeConnector {
    private publicWebsocketFeed!: WebSocket;
    private gateSymbol: string;
    private sklSymbol: string
    private publicWebsocketAddress: string = 'wss://api.gateio.ws/ws/v4/';
    public bids: GateOrderBookLevel[] = [];
    public asks: GateOrderBookLevel[] = [];

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        const self = this;
        self.gateSymbol = getGateSymbol(self.group, self.config);
        self.sklSymbol = getSklSymbol(self.group, self.config)
    }

    public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
        const self = this;
        const publicFeed = new Promise((resolve) => {
            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);

            self.publicWebsocketFeed.on('open', () => {
                logger.info('Public WebSocket connection opened');
                self.subscribeToProducts('spot.ping');
                self.subscribeToProducts('spot.trades');
                self.subscribeToProducts('spot.order_book_update');
                self.subscribeToProducts('spot.tickers');
                resolve(true);
            });

            self.publicWebsocketFeed.on('message', (message: any) => {
                const gateEvent = JSON.parse(message.data);

                if (gateEvent.channel === "spot.ping") {
                    logger.log(`Ping received: timestamp = ${gateEvent.time}`);
                } else {
                    const actionType: SklEvent | null = getEventType(gateEvent);
                    if (actionType) {
                        const serializableMessages: Serializable[] = self.createSklEvent(actionType, gateEvent, self.group)
                            .filter((serializableMessage: Serializable | null) => serializableMessage !== null) as Serializable[];

                        if (serializableMessages.length > 0) {
                            onMessage(serializableMessages);
                        } else {
                            logger.log(`No messages generated for event: ${JSON.stringify(gateEvent)}`);
                        }
                    } else {
                        logger.log(`No handler for message: ${JSON.stringify(gateEvent)}`);
                    }
                }
            });

            self.publicWebsocketFeed.on('error', (error: Error) => {
                logger.error('WebSocket error:', error);
            });

            self.publicWebsocketFeed.on('close', () => {
                logger.warn('WebSocket connection closed, attempting to reconnect');
                setTimeout(() => {
                    self.connect(onMessage);
                }, 1000);
            });
        });

        await Promise.all([publicFeed]);
    }

    private subscribeToProducts(channel: string): void {
        const self = this;

        const products = [self.gateSymbol]
        const current_time = Math.floor(Date.now() / 1000);

        const subscriptionMessage = {
            time: current_time,
            channel: channel,
            event: "subscribe",
            payload: products,
        };

        self.publicWebsocketFeed.send(JSON.stringify(subscriptionMessage));
        logger.info(`Subscribed to channel: ${channel}.${self.gateSymbol}`);
    }

    private updateBook(orderBookUpdate: GateOrderBookUpdate): void {
        const self = this;

        // Process bids
        orderBookUpdate.b.forEach(([price, amount]: [string, string]) => {
            const eventIndex = self.bids.findIndex(b => b.price_level === price);
            if (parseFloat(amount) === 0 && eventIndex !== -1) {
                self.bids.splice(eventIndex, 1);
            } else if (parseFloat(amount) > 0 && eventIndex === -1) {
                self.bids.push({ price_level: price, new_quantity: amount });
                self.bids.sort((a, b) => parseFloat(b.price_level) - parseFloat(a.price_level));
            }
        });

        // Process asks
        orderBookUpdate.a.forEach(([price, amount]: [string, string]) => {
            const eventIndex = self.asks.findIndex(a => a.price_level === price);
            if (parseFloat(amount) === 0 && eventIndex !== -1) {
                self.asks.splice(eventIndex, 1);
            } else if (parseFloat(amount) > 0 && eventIndex === -1) {
                self.asks.push({ price_level: price, new_quantity: amount });
                self.asks.sort((a, b) => parseFloat(a.price_level) - parseFloat(b.price_level));
            }
        });
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {
        const self = this;

        if (event === 'TopOfBook') {
            const orderBookUpdates = message.result; // Handle Gate.io order book updates
            self.updateBook(orderBookUpdates);
            return [self.createTopOfBook(message.result.t)];
        }
        else if (event === 'Trade') {
            const trades = message.result;
            return trades.map((trade: any) => self.createTrade(trade));
        }
        else if (event === 'Ticker') {
            const tickers = message.result;
            return tickers.map((ticker: any) => self.createTicker(ticker));
        }
        else {
            logger.log(`Unhandled event: ${event}`);
            return [];
        }
    }



    // Create a TopOfBook event from order book update data
    private createTopOfBook(orderBookUpdate: any): TopOfBook {
        const self = this;
        if (orderBookUpdate.b.length === 0 || orderBookUpdate.a.length === 0) {
            return null;
        }
        return {
            symbol: self.sklSymbol,
            connectorType: 'Gate',
            event: 'TopOfBook',
            timestamp: orderBookUpdate.t, // Assuming this is in milliseconds
            askPrice: parseFloat(orderBookUpdate.a[0][0]),
            askSize: parseFloat(orderBookUpdate.a[0][1]),
            bidPrice: parseFloat(orderBookUpdate.b[0][0]),
            bidSize: parseFloat(orderBookUpdate.b[0][1]),
        };
    }


    private createTrade(trade: GateTrade): Trade | null {
        const self = this;
        const tradeSide: string | undefined = trade.side

        if (tradeSide) {
            return {
                symbol: self.sklSymbol,
                connectorType: 'Gate',
                event: 'Trade',
                price: parseFloat(trade.price),
                amount: parseFloat(trade.amount),
                side: GateSideMap[tradeSide],
                timestamp: (new Date(trade.create_time)).getTime(),
            }
        } else {
            return null
        }
    }


    private createTicker(ticker: GateTicker): Ticker {
        const self = this;
        return {
            symbol: self.sklSymbol,
            connectorType: 'Gate',
            event: 'Ticker',
            lastPrice: parseFloat(ticker.last),
            bidPrice: parseFloat(ticker.highest_bid),
            askPrice: parseFloat(ticker.lowest_ask),
            volume: parseFloat(ticker.base_volume),
            timestamp: Date.now(),
        };
    }


    public async unsubscribeToProducts(channel: string): Promise<void> {
        const self = this;
        const products = [self.gateSymbol]
        const current_time = Math.floor(Date.now() / 1000);
        if (self.publicWebsocketFeed) {
            const unsubscribeMessage = {
                time: current_time,
                channel: channel,
                event: "subscribe",
                payload: products,
            };

            self.publicWebsocketFeed.send(JSON.stringify(unsubscribeMessage));
            self.publicWebsocketFeed.close();
            logger.info('Public WebSocket connection closed and unsubscribed from channels');
        }
    }
}
