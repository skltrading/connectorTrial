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
import { getSklSymbol } from "../../util/config";
import { log } from "console";

const logger = Logger.getInstance('gate-spot-public-connector');

interface GateEvent {
    channel: string;
    time: string;
    sequence_num: number;
    result: any;  // Add result here, which will store the data for trades, tickers, etc.
}


export interface GateTrade {
    id: number;                    // Trade ID
    create_time: number;           // Trade Unix timestamp in seconds
    create_time_ms: string;        // Trading Unix timestamp in milliseconds
    side: GateTradeSide;           // Taker side (buy/sell)
    currency_pair: string;         // Currency pair (e.g., BTC_USDT)
    amount: string;                // Trade size (amount)
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
    b: string;
    a: string;
    B: string;
    A: string;

}

// Utility function to map event types
const getEventType = (message: any): SklEvent | null => {
    if (message.channel === 'spot.book_ticker') {
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
    private gateSymbol: string = '';
    private sklSymbol: string = '';
    private readonly publicWebsocketAddress: string = 'wss://api.gateio.ws/ws/v4/';
    public bids: GateOrderBookLevel[] = [];
    public asks: GateOrderBookLevel[] = [];

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        const self = this;
        self.gateSymbol = getGateSymbol(self.group, self.config) || '';
        self.sklSymbol = getSklSymbol(self.group, self.config) || '';
    }

    public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
        const self = this;
        const publicFeed = new Promise((resolve) => {
            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);

            // Handle WebSocket 'open' event
            self.publicWebsocketFeed.on('open', () => {
                logger.info('Public WebSocket connection opened v2');
                self.subscribeToProducts('spot.ping');
                self.subscribeToProducts('spot.trades');
                self.subscribeToProducts('spot.book_ticker');
                self.subscribeToProducts('spot.tickers');
                resolve(true);
            });

            //logger.info('Subscribed to channels');

            // Handle incoming WebSocket messages
            self.publicWebsocketFeed.on('message', (message: any) => {
                //logger.log(`Received message: ${JSON.stringify(message)}`);
                try {
                    const parsedMessage = JSON.parse(message);
                    const gateEvent = parsedMessage;
                    //logger.log(`Received message: ${JSON.stringify(gateEvent)}`);
                    if (gateEvent.channel === "spot.ping") {
                        // logger.log(`Ping received: timestamp = ${gateEvent.time}`);
                    } else {
                        const actionType: SklEvent | null = getEventType(gateEvent);
                        if (actionType) {
                            const result = gateEvent; // Get the result data

                            let serializableMessages: Serializable[] = [];

                            // Check if result is an array or a single object and handle accordingly
                            if (Array.isArray(result)) {
                                serializableMessages = result.map((trade: any) => self.createSklEvent(actionType, trade, self.group)).flat();
                            } else {
                                // If the result is a single object
                                serializableMessages = [...self.createSklEvent(actionType, result, self.group)];
                            }

                            if (serializableMessages.length > 0) {
                                onMessage(serializableMessages);
                            } else {
                                logger.log(`No messages generated for event: ${JSON.stringify(gateEvent)}`);
                            }
                        } else {
                            logger.log(`No handler for message: ${JSON.stringify(gateEvent)}`);
                        }
                    }
                } catch (error: any) {
                    logger.error(`Error parsing WebSocket message: ${error.message}`, message);
                }
            });

            // Handle WebSocket 'error' event
            self.publicWebsocketFeed.on('error', (error: Error) => {
                logger.error('WebSocket error:', error);
            });

            // Handle WebSocket 'close' event
            self.publicWebsocketFeed.on('close', () => {
                logger.warn('WebSocket connection closed, attempting to reconnect private');
                setTimeout(() => {
                    self.connect(onMessage);
                }, 1000);
            });
        });

        await Promise.all([publicFeed]);
    }


    private subscribeToProducts(channel: string): void {
        const self = this;

        const products = [self.gateSymbol];
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

    private updateBook(orderBookUpdate: any): void {
        const self = this;

        // Access the result object containing the best bid and ask prices
        const result = orderBookUpdate;

        // Ensure the result object is defined and contains the required properties
        if (result && result.b && result.B && result.a && result.A) {
            // Clear the current bids and asks arrays since we are only interested in the best bid and ask
            self.bids = [];
            self.asks = [];

            // Process the best bid (b) and best ask (a)
            const bestBidPrice = result.b;
            const bestBidSize = result.B;
            const bestAskPrice = result.a;
            const bestAskSize = result.A;

            // If there is a valid bid, add it to the bids array
            if (parseFloat(bestBidSize) > 0) {
                self.bids.push({
                    price_level: bestBidPrice,
                    new_quantity: bestBidSize
                });
            }

            // If there is a valid ask, add it to the asks array
            if (parseFloat(bestAskSize) > 0) {
                self.asks.push({
                    price_level: bestAskPrice,
                    new_quantity: bestAskSize
                });
            }

            // Sort bids (highest first) and asks (lowest first)
            self.bids.sort((a, b) => parseFloat(b.price_level) - parseFloat(a.price_level));
            self.asks.sort((a, b) => parseFloat(a.price_level) - parseFloat(b.price_level));

            // // Log the updated best bid and ask
            // logger.info(`Updated Best Bid: ${bestBidPrice}, Size: ${bestBidSize}`);
            // logger.info(`Updated Best Ask: ${bestAskPrice}, Size: ${bestAskSize}`);
        } else {
            logger.error('Received invalid order book update message:', orderBookUpdate);
        }
    }



    private logSerializableEvent(eventType: string, data: Serializable) {
        logger.info(`Sending: ${data.symbol}.${data.connectorType}.${eventType} -> ${JSON.stringify(data)}`);
    }


    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {
        const self = this;
        if (event === 'TopOfBook') {
            const orderBookUpdates = message.result; // Assuming message.result contains the book updates
            self.updateBook(orderBookUpdates);
            const topOfBook = self.createTopOfBook(message.result);
            if (topOfBook) {
                this.logSerializableEvent('TopOfBook', topOfBook);
                return [topOfBook];
            }
            return [];
        } else if (event === 'Trade') {
            const trades = [message.result];  // Adjust as per the actual message structure (result may be array or single trade)
            return trades.map((trade: any) => {
                const createdTrade = self.createTrade(trade);
                if (createdTrade) {
                    this.logSerializableEvent('Trade', createdTrade);
                }
                return createdTrade;
            }).filter(trade => trade !== null);
        } else if (event === 'Ticker') {
            const ticker = self.createTicker(message.result);
            this.logSerializableEvent('Ticker', ticker);
            return [ticker];
        } else {
            logger.log(`Unhandled event: ${event}`);
            return [];
        }
    }
    private createTopOfBook(orderBookUpdate: any): TopOfBook | null {
        const self = this;
        if (orderBookUpdate.b.length === 0 || orderBookUpdate.a.length === 0) {
            return null;
        }
        return {
            symbol: self.sklSymbol,
            connectorType: 'Gate',
            event: 'TopOfBook',
            timestamp: orderBookUpdate.t,  // Assuming t is in milliseconds
            askPrice: parseFloat(orderBookUpdate.a),
            askSize: parseFloat(orderBookUpdate.A),
            bidPrice: parseFloat(orderBookUpdate.b),
            bidSize: parseFloat(orderBookUpdate.B),
        };
    }
    private createTrade(trade: GateTrade): Trade | null {
        const self = this;
        const tradeSide: string | undefined = trade.side;

        if (tradeSide && GateSideMap[tradeSide.toLowerCase()]) {
            return {
                symbol: self.sklSymbol,
                connectorType: 'Gate',
                event: 'Trade',
                price: parseFloat(trade.price),
                amount: parseFloat(trade.amount),
                side: GateSideMap[tradeSide.toLowerCase()],  // Correct mapping for side
                timestamp: trade.create_time * 1000,  // Ensure correct timestamp format (milliseconds)
            };
        } else {
            return null;
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
        const products = [self.gateSymbol];
        const current_time = Math.floor(Date.now() / 1000);
        if (self.publicWebsocketFeed) {
            const unsubscribeMessage = {
                time: current_time,
                channel: channel,
                event: "unsubscribe",
                payload: products,
            };

            self.publicWebsocketFeed.send(JSON.stringify(unsubscribeMessage));
            self.publicWebsocketFeed.close();
            logger.info('Public WebSocket connection closed and unsubscribed from channels');
        }
    }

    public async stop() {
        const self = this;
        await self.unsubscribeToProducts('spot.trades');
        await self.unsubscribeToProducts('spot.book_ticker');
        await self.unsubscribeToProducts('spot.tickers');
    }
}
