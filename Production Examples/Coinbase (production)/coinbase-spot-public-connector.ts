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
} from "../../types"

import {
    CoinbaseTradeSide,
    getCoinbaseSymbol,
    sideMap,
    tradeSideMap,
} from './coinbase-spot'
import { WebSocket } from 'ws'
import { Logger } from "../../util/logging"
import CryptoJS from "crypto-js";
import { getSklSymbol } from "../../util/config";
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const logger = Logger.getInstance('coinbase-spot-public-connector')

type CoinbaseEventType = 'snapshot' | 'update'

interface CoinbaseEvent {
    channel: string,
    timestamp: string,
    sequence_num: number,
    events: CoinbaseMarketDepthEvent[] | CoinbaseTradeEvent[] | CoinbaseTickerEvent[] | CoinbaseHeartbeatEvent[],
}

interface CoinbaseHeartbeatEvent {
    current_time: string,
    heartbeat_counter: string,
}

type CoinbaseMarketDepthSide = 'bid' | 'offer'
interface CoinbaseMarketDepthLevel {
    side: CoinbaseMarketDepthSide,
    event_time: string,
    price_level: string,
    new_quantity: string,
}

interface CoinbaseMarketDepthEvent {
    type: CoinbaseEventType,
    product_id: string,
    updates: CoinbaseMarketDepthLevel[],
}

interface CoinbaseTicker {
    product_id: string;
    price: string;
}

interface CoinbaseTickerEvent {
    type: CoinbaseEventType,
    tickers: CoinbaseTicker[],
}

interface CoinbaseTrade {
    trade_id: string,
    product_id: string;
    price: string;
    size: string;
    side: CoinbaseTradeSide;
    time: string;
}

interface CoinbaseTradeEvent {
    type: CoinbaseEventType,
    trades: CoinbaseTrade[],
}

const getEventType = (message: CoinbaseEvent): SklEvent | null => {
    if (message.channel === 'l2_data') {
        return 'TopOfBook'
    } else if (message.channel === 'market_trades') {
        return 'Trade'
    } else if (message.channel === 'ticker') {
        return 'Ticker'
    }
    return null
}

export class CoinbaseSpotPublicConnector implements PublicExchangeConnector {
    public publicWebsocketAddress = 'wss://advanced-trade-ws.coinbase.com'
    public restUrl = 'https://api.coinbase.com'
    public publicWebsocketFeed: any
    private coinbaseSymbol: string
    private sklSymbol: string
    public bids: CoinbaseMarketDepthLevel[] = []
    public asks: CoinbaseMarketDepthLevel[] = []

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        const self = this
        self.coinbaseSymbol = getCoinbaseSymbol(self.group, self.config)
        self.sklSymbol = getSklSymbol(self.group, self.config)
    }

    public async connect(onMessage: (m: Serializable[]) => void): Promise<any> {
        const self = this
        const publicFeed = new Promise((resolve) => {
            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);
            self.publicWebsocketFeed.on('open', () => {
                self.subscribeToProducts('heartbeats')
                self.subscribeToProducts('ticker')
                self.subscribeToProducts('market_trades')
                self.subscribeToProducts('level2')
                resolve(true);
                
            });

            self.publicWebsocketFeed.onmessage = (message: any) => {
                const coinbaseEvent: CoinbaseEvent = JSON.parse(message.data) as CoinbaseEvent
                if (coinbaseEvent.channel === "heartbeats") {
                    const heartbeats = coinbaseEvent.events as CoinbaseHeartbeatEvent[]
                    heartbeats.map((event: CoinbaseHeartbeatEvent) => {
                        logger.log(`Heartbeat: symbol = ${self.sklSymbol}, counter = ${event.heartbeat_counter}`);
                    })
                } else {
                    const actionType: SklEvent | null = getEventType(coinbaseEvent)
                    if (actionType) {
                        const serializableMessages: Serializable[] = self.createSklEvent(actionType, coinbaseEvent, self.group)
                            .filter((serializableMessage: Serializable | null) => serializableMessage !== null) as Serializable[]
                        if (0 < serializableMessages.length) {
                            onMessage(serializableMessages);
                        } else {
                            logger.log(`No messages generated for event: ${JSON.stringify(coinbaseEvent)}`)
                        }
                    } else {
                        logger.log(`No handler for message: ${JSON.stringify(coinbaseEvent)}`)
                    }
                }
            }

            self.publicWebsocketFeed.on('error', function error(err: any) {
                logger.log(`WebSocket error: ${err.toString()}`);
            });

            self.publicWebsocketFeed.on('close', (code, reason) => {
                const self = this
                logger.log(`WebSocket closed: ${code} - ${reason}`);
                setTimeout(() => {
                    self.connect(onMessage)
                }, 1000);
            });
        })

        return await Promise.all([publicFeed]);
    }

    public async stop() {
        const self = this
        self.unsubscribeToProducts('heartbeats')
        self.unsubscribeToProducts('ticker')
        self.unsubscribeToProducts('level2')
    }

    private createSklEvent(event: SklEvent, message: CoinbaseEvent, group: ConnectorGroup): Serializable[] {
        const self = this
        if (event === 'TopOfBook') {
            const marketDepth: CoinbaseMarketDepthEvent[] = message.events as CoinbaseMarketDepthEvent[]
            marketDepth.map((event: CoinbaseMarketDepthEvent) => {
                self.updateBook(event)
            })
            return [self.createTopOfBook(message.timestamp)]
        }
        else if (event === 'Trade') {
            const trades: CoinbaseTradeEvent[] = message.events as CoinbaseTradeEvent[]
            return trades
                .flatMap((event: CoinbaseTradeEvent) => {
                    const mixedTrades: (Trade | null)[] = event.trades
                        .map((trade: CoinbaseTrade) => {
                            return self.createTrade(trade)
                        })
                    const sklTrades: Trade[] = mixedTrades.filter((trade: Trade | null) => trade !== null) as Trade[]
                    return sklTrades
                })

        } else if (event === 'Ticker') {
            const tickers: CoinbaseTickerEvent[] = message.events as CoinbaseTickerEvent[]
            return tickers
                .flatMap((event: CoinbaseTickerEvent) => {
                    const mixedTickers: (Ticker | null)[] = event.tickers
                        .map((trade: CoinbaseTicker) => {
                            return self.createTicker(message.timestamp, trade)
                        })
                    const sklTickers: Ticker[] = mixedTickers.filter((ticker: Ticker | null) => ticker !== null) as Ticker[]
                    return sklTickers
                })
        } else {
            logger.log(`Unhandled public connector event: ${event}`)
            return []
        }
    }

    private updateBook(event: CoinbaseMarketDepthEvent) {
        const self = this
        const eventData = event.updates
        const bidsList = eventData.filter((event: CoinbaseMarketDepthLevel) => event.side === "bid")
        const asksList = eventData.filter((event: CoinbaseMarketDepthLevel) => event.side === "offer")

        // initial orderbook
        if (event.type === "snapshot") {
            self.bids = bidsList
            self.asks = asksList
            // updates for orderbook
        } else {
            // updates for bids
            bidsList.forEach((event: any) => {
                const eventIndex = self.bids.findIndex(bid => bid.price_level === event.price_level)
                // remove existing bid if no more quantity
                if (event.new_quantity === "0" && eventIndex !== -1) {
                    self.bids.splice(eventIndex, 1)
                    // add bid with quantity if not already in array - sorted descending
                } else if (parseFloat(event.new_quantity) > 0 && eventIndex === -1) {
                    self.bids.unshift(event)
                    self.bids.sort((a, b) => parseFloat(b.price_level) - parseFloat(a.price_level))
                }
            })

            // updates for asks
            asksList.forEach((event: any) => {
                const eventIndex = self.asks.findIndex(ask => ask.price_level === event.price_level)
                // remove existing ask
                if (event.new_quantity === "0" && eventIndex !== -1) {
                    self.asks.splice(eventIndex, 1)
                    // add ask with quantity if not already in array - sorted ascending
                } else if (parseFloat(event.new_quantity) > 0 && eventIndex === -1) {
                    self.asks.unshift(event)
                    self.asks.sort((a, b) => parseFloat(a.price_level) - parseFloat(b.price_level))
                }

            })
        }
    }

    private createTopOfBook(timestamp): TopOfBook | null {
        const self = this
        if (self.bids.length === 0 || self.asks.length === 0) {
            return null
        }
        return {
            symbol: self.sklSymbol,
            connectorType: 'Coinbase',
            event: 'TopOfBook',
            timestamp: (new Date(timestamp)).getTime(),
            askPrice: parseFloat(self.asks[0].price_level),
            askSize: parseFloat(self.asks[0].new_quantity),
            bidPrice: parseFloat(self.bids[0].price_level),
            bidSize: parseFloat(self.bids[0].new_quantity),
        };
    }

    private createTicker(timestamp: string, trade: CoinbaseTicker): Ticker {
        const self = this
        return {
            symbol: self.sklSymbol,
            connectorType: 'Coinbase',
            event: 'Ticker',
            lastPrice: parseFloat(trade.price),
            timestamp: (new Date(timestamp)).getTime(),
        };
    }

    private createTrade(trade: CoinbaseTrade): Trade | null {
        const self = this
        const tradeSide: string | undefined = trade.side
        if (tradeSide) {
            return {
                symbol: self.sklSymbol,
                connectorType: 'Coinbase',
                event: 'Trade',
                price: parseFloat(trade.price),
                size: parseFloat(trade.size),
                side: tradeSideMap[tradeSide],
                timestamp: (new Date(trade.time)).getTime(),
            }
        } else {
            return null
        }
    }

    private sign(str, secret) {
        const hash = CryptoJS.HmacSHA256(str, secret);
        return hash.toString();
    }


    private timestampAndSign(message: any, channel: string, products: string[] = []) {
        const self = this
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const strToSign = `${timestamp}${channel}${products.join(',')}`;
        const sig = self.sign(strToSign, self.credential.secret);
        return { ...message, signature: sig, timestamp: timestamp };
    }

    private subscribeToProducts(channelName: string) {

        const self = this

        const products = [self.coinbaseSymbol]

        const message = {
            type: 'subscribe',
            channel: channelName,
            product_ids: products,
        };

        const subscribeMsg = self.signWithJWT(message,channelName, products);

        console.log('Sending message', subscribeMsg);

        self.publicWebsocketFeed.send(JSON.stringify(subscribeMsg));
    }

    private unsubscribeToProducts(channelName: string) {
        const self = this
        const products = [self.coinbaseSymbol]
        const message = {
            type: 'unsubscribe',
            channel: channelName,
            api_key: self.credential.key,
            product_ids: products,
        };
        const subscribeMsg = self.timestampAndSign(message, channelName, products);
        self.publicWebsocketFeed.send(JSON.stringify(subscribeMsg));
    }

    private generateJwt(uri: string) {

        const payload = {
            iss: 'cdp',
            nbf: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 120,
            sub: this.credential.key,
            uri,
        };

        const header = {
            alg: 'ES256',
            kid: this.credential.key,
            nonce: crypto.randomBytes(16).toString('hex'),
        };

        return jwt.sign(payload, this.credential.secret, { algorithm: 'ES256', header });

    }

    private signWithJWT(message, channel, products = []) {

        const payload = {
            iss: "cdp",
            nbf: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 120,
            sub: this.credential.key,
        };

        const header = {
            alg: 'ES256',
            kid: this.credential.key,
            nonce: crypto.randomBytes(16).toString('hex'),
        };

        const result = jwt.sign(payload, this.credential.secret, { algorithm: 'ES256', header });


        return { ...message, jwt: result };
    }


}