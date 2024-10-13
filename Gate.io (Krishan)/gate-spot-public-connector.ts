import {
    ConnectorConfiguration,
    ConnectorGroup,
    PublicExchangeConnector,
    Serializable,
    SklEvent,
    Ticker,
    TopOfBook,
    Trade,
} from "../../types";
import {
    getGateSymbol,
} from './gate-spot';
import { WebSocket } from 'ws';
import { Logger } from "../../util/logging";

const logger = Logger.getInstance('gate-spot-public-connector');

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
    private exchangeSymbol: string;
    private publicWebsocketAddress: string = 'wss://api.gateio.ws/ws/v4/';

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
    ) {
        const self = this;
        self.exchangeSymbol = getGateSymbol(self.group, self.config);
    }


    public async connect(onMessage: (messages: Serializable[]) => void): Promise<any> {
        const self = this;


        const publicFeed = new Promise((resolve) => {
            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);

            self.publicWebsocketFeed.on('open', () => {
                logger.info('Public WebSocket connection opened');


                self.subscribeToProducts('spot.trades');
                self.subscribeToProducts('spot.order_book_update');
                self.subscribeToProducts('spot.tickers');

                resolve(true);  // Resolve the promise once connected and subscriptions are done
            });

            self.publicWebsocketFeed.onmessage = (message: any) => {
                self.handleMessage(message, onMessage);
            };

            self.publicWebsocketFeed.on('error', (error: Error) => {
                logger.error('WebSocket error:', error);
            });

            self.publicWebsocketFeed.on('close', () => {
                logger.warn('Public WebSocket connection closed, attempting to reconnect');
                setTimeout(() => {
                    self.connect(onMessage);
                }, 1000); // Reconnect after 1 second
            });
        });

        return await Promise.all([publicFeed]);
    }


    private subscribeToProducts(channel: string): void {
        const self = this;

        const subscriptionMessage = {
            method: 'subscribe',
            params: [`${channel}.${self.exchangeSymbol}`],
            id: Math.random().toString(36).substring(7),  // Unique ID for the request
        };

        self.publicWebsocketFeed.send(JSON.stringify(subscriptionMessage));
        logger.info(`Subscribed to channel: ${channel}.${self.exchangeSymbol}`);
    }


    private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
        const self = this;
        const message = JSON.parse(data);
        const eventType = getEventType(message);

        if (eventType) {
            switch (eventType) {
                case 'TopOfBook':
                    const orderBookEvent: TopOfBook = self.createTopOfBook(message.result);
                    onMessage([orderBookEvent]);
                    break;
                case 'Trade':
                    const tradeEvents = self.createTrade(message.result);
                    onMessage(tradeEvents);
                    break;
                case 'Ticker':
                    const tickerEvent: Ticker = self.createTicker(message.result);
                    onMessage([tickerEvent]);
                    break;
                default:
                    logger.warn(`Unhandled event type: ${eventType}`);
            }
        } else {
            logger.warn('Unknown event type:', message.event);
        }
    }

    // Create a TopOfBook event from order book update data
    private createTopOfBook(orderBookUpdate: any): TopOfBook {
        const self = this;
        return {
            symbol: self.exchangeSymbol,
            connectorType: 'Gate',
            event: 'TopOfBook',
            timestamp: orderBookUpdate.t,
            askPrice: parseFloat(orderBookUpdate.a[0][0]),
            askSize: parseFloat(orderBookUpdate.a[0][1]),
            bidPrice: parseFloat(orderBookUpdate.b[0][0]),
            bidSize: parseFloat(orderBookUpdate.b[0][1]),
        };
    }


    private createTrade(trades: any[]): Trade[] {
        const self = this;
        return trades.map(trade => ({
            symbol: self.exchangeSymbol,
            connectorType: 'Gate',
            event: 'Trade',
            price: parseFloat(trade.price),
            size: parseFloat(trade.amount),
            side: trade.side === 'buy' ? 'Buy' : 'Sell',  // Trade side mapping
            timestamp: new Date(trade.create_time).getTime(),
        }));
    }


    private createTicker(ticker: any): Ticker {
        const self = this;
        return {
            symbol: self.exchangeSymbol,
            connectorType: 'Gate',
            event: 'Ticker',
            lastPrice: parseFloat(ticker.last),
            bidPrice: parseFloat(ticker.highest_bid),
            askPrice: parseFloat(ticker.lowest_ask),
            volume: parseFloat(ticker.base_volume),
            timestamp: Date.now(),
        };
    }


    public async stop(): Promise<void> {
        const self = this;
        if (self.publicWebsocketFeed) {
            const unsubscribeMessage = {
                method: 'unsubscribe',
                params: [
                    `spot.trades.${self.exchangeSymbol}`,
                    `spot.order_book_update.${self.exchangeSymbol}`,
                    `spot.tickers.${self.exchangeSymbol}`,
                ],
                id: Math.random().toString(36).substring(7),
            };

            self.publicWebsocketFeed.send(JSON.stringify(unsubscribeMessage));
            self.publicWebsocketFeed.close();
            logger.info('Public WebSocket connection closed and unsubscribed from channels');
        }
    }
}
