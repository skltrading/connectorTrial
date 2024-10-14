import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, SklEvent, Ticker, TopOfBook, Trade } from "../../types";
//import { getSklSymbol } from "../../util/config";

import { Logger } from "../../util/logging";
import { getBinanceSymbol, BinanceSideMap, getSklSymbol } from "./binance-spot";
import { WebSocket } from 'ws'



export interface BinanceMarketDepth {
    lastUpdateId: number;
    bids: [string, string][];  // [price , quantity]
    asks: [string, string][];
}

export interface BinanceTicker {
    e: string;   // '24hrMiniTicker'
    E: number;   // Event time in milliseconds
    s: string;   // Symbol
    c: string;   // Close price
    o: string;   // Open price
    h: string;   // High price
    l: string;   // Low price
    v: string;   // Total traded base asset volume
    q: string;   // Total traded quote asset volume
}

export interface BinanceTradeEvent {
    e: string;       //  'trade'
    E: number;       // Event time in milliseconds 
    s: string;       // Symbol
    t: number;       // Trade ID
    p: string;       // Price
    q: string;       // Quantity
    T: number;       // Trade time in milliseconds
    m: boolean;      // Is the buyer the market maker?
    M: boolean;      // Ignore
}

const logger = Logger.getInstance('binance-spot-public-connector');

export class BinanceSpotPublicConnector implements PublicExchangeConnector {
    public publicWebsocketAddress = 'wss://testnet.binance.vision/ws';

    public publicWSFeed: any;

    //private pingInterval: any;

    private exchangeSymbol: string;

    private sklSymbol: string;

    constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        this.exchangeSymbol = getBinanceSymbol(this.group, this.config);
        this.sklSymbol = getSklSymbol(this.group, this.config);
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                logger.log(`Attempting to connect to Binance`);

                const url = this.publicWebsocketAddress;
                this.publicWSFeed = socket || new WebSocket(url);

                this.publicWSFeed.on('open', () => {
                    try {
                        const message = JSON.stringify({
                            'method': 'SUBSCRIBE',
                            'params': [
                                `${this.exchangeSymbol}@miniTicker`,
                                `${this.exchangeSymbol}@trade`,
                                `${this.exchangeSymbol}@depth5`
                            ],
                            "id": 1
                        });

                        this.publicWSFeed.send(message);
                        resolve(true);
                    } catch (err: any) {
                        logger.error(`Error during WebSocket open event: ${err.message}`);
                        reject(err);
                    }
                });

                this.publicWSFeed.onmessage = (message: { data: any; }) => {
                    try {
                        const data = JSON.parse(message.data);
                        const actionType: SklEvent | null = this.getEventType(data);

                        if (actionType) {
                            const serializableMessages: Serializable[] = this.createSklEvent(actionType, data, this.group);
                            onMessage(serializableMessages);
                        } else {
                            logger.log(`No handler for message: ${JSON.stringify(data)}`);
                        }
                    } catch (err: any) {
                        logger.error(`Error processing WebSocket message: ${err.message}`);
                    }
                };

                this.publicWSFeed.on('ping', () => {
                    this.publicWSFeed.pong();
                });

                this.publicWSFeed.on('error', (err: any) => {
                    logger.error(`WebSocket error: ${err.message || err.toString()}`);
                    reject(err);
                });

                this.publicWSFeed.on('close', (code: number, reason: string) => {
                    logger.log(`WebSocket closed: ${code} - ${reason}`);

                    setTimeout(() => {
                        logger.log(`Reconnecting to WebSocket...`);
                        this.connect(onMessage).catch(reject);
                    }, 1000);
                });

                if (this.publicWSFeed.__init !== undefined) {
                    this.publicWSFeed.__init();
                }

            } catch (error: any) {
                logger.error(`Error during WebSocket connection setup: ${error.message}`);
                reject(error);
            }
        });
    }

    public async stop() {

        //clearInterval(this.pingInterval);

        const message = JSON.stringify({
            'method': 'UNSUBSCRIBE',
            'params': [
                `${this.exchangeSymbol}@miniTicker`,
                `${this.exchangeSymbol}@trade`,
                `${this.exchangeSymbol}@depth5`
            ],
            "id": 1
        });

        this.publicWSFeed.send(message);
    }

    private getEventType(message: any): SklEvent | null {

        const event = message;

        if (event !== undefined && event.c !== undefined) {

            if ('bids' in message && 'ask' in message) {

                return 'TopOfBook'

            } else if (message.e === "trade") {

                return 'Trade'

            } else if (message.e === "24hrMiniTicker") {

                return 'Ticker'

            }
        }

        return null
    }



    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {

        if (event === 'TopOfBook') {

            const topBidAndAsk: BinanceMarketDepth = message
            return [this.createTopOfBook(topBidAndAsk, group)]

        }
        else if (event === 'Trade') {

            const trade: BinanceTradeEvent = message;
            return [this.createTrade(trade)]

        } else if (event === 'Ticker') {
            return [this.createTicker(message, group)]

        } else {

            return []

        }
    }

    private createTrade(trade: BinanceTradeEvent): Trade | null {

        const tradeSide: string | undefined = String(trade.m);

        if (tradeSide) {
            return {
                symbol: this.sklSymbol,
                connectorType: 'Binance',
                event: 'Trade',
                price: parseFloat(trade.p),
                size: parseFloat(trade.q),
                side: BinanceSideMap[tradeSide],
                timestamp: trade.T * 1000,
            }
        } else {
            return null;
        }
    }

    private createTopOfBook(marketDepth: BinanceMarketDepth, group: ConnectorGroup): TopOfBook {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Binance',
            event: 'TopOfBook',
            timestamp: 0, // binance do not send timestamps with partial book depth data stream 
            askPrice: parseFloat(marketDepth.asks[0][0]),
            askSize: parseFloat(marketDepth.asks[0][1]),
            bidPrice: parseFloat(marketDepth.bids[0][0]),
            bidSize: parseFloat(marketDepth.bids[0][1]),
        };
    }

    private createTicker(trade: BinanceTicker, group: ConnectorGroup): Ticker {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Binance',
            event: 'Ticker',
            lastPrice: parseFloat(trade.c),
            timestamp: trade.E * 1000,
        };
    }

}