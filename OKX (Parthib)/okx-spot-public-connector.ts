import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, SklEvent, Ticker, TopOfBook, Trade } from "../../types";
import { getSklSymbol } from "../../util/config";
import { Logger } from "../../util/logging";
import { getOkxSymbol, OkxSideMap } from "./okx-spot";
import { WebSocket } from 'ws';

const logger = Logger.getInstance('okx-spot-public-connector');

export interface OkxMarketDepth {
    bids: Array<[string, string, string, string]>;
    asks: Array<[string, string, string, string]>;
    ts: string;
}

export interface OkxTicker {
    instId: string;
    last: string;
    lastSz: string;
    askPx: string;
    askSz: string;
    bidPx: string;
    bidSz: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    ts: string;
}

export interface OkxTrade {
    instId: string;
    tradeId: string;
    px: string;
    sz: string;
    side: string;
    ts: string;
}

export class OkxSpotPublicConnector implements PublicExchangeConnector {
    public publicWebsocketAddress = 'wss://ws.okx.com:8443/ws/v5/public';
    public publicWSFeed: WebSocket | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private exchangeSymbol: string;
    private sklSymbol: string;

    constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        this.exchangeSymbol = getOkxSymbol(this.group, this.config);
        this.sklSymbol = getSklSymbol(this.group, this.config);
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {
        return new Promise(async (resolve) => {
            logger.log(`Attempting to connect to OKX`);

            this.publicWSFeed = socket || new WebSocket(this.publicWebsocketAddress);

            this.publicWSFeed.on('open', () => {
                const subscribeMessage = JSON.stringify({
                    op: 'subscribe',
                    args: [
                        { channel: 'trades', instId: this.exchangeSymbol },
                        { channel: 'books5', instId: this.exchangeSymbol },
                        { channel: 'tickers', instId: this.exchangeSymbol }
                    ]
                });

                this.publicWSFeed!.send(subscribeMessage);

                this.pingInterval = setInterval(() => {
                    console.log('Pinging OKX');
                    this.publicWSFeed!.send('ping');
                }, 1000 * 15);

                resolve(true);
            });

            this.publicWSFeed.on('message', (message: WebSocket.Data) => {
                const data = JSON.parse(message.toString());

                if (data.event === 'subscribe' || data.event === 'error') {
                    logger.log(`Received ${data.event} event: ${JSON.stringify(data)}`);
                    return;
                }

                const actionType: SklEvent | null = this.getEventType(data);

                if (actionType) {
                    const serializableMessages: Serializable[] = this.createSklEvent(actionType, data, this.group);
                    onMessage(serializableMessages);
                } else {
                    logger.log(`No handler for message: ${JSON.stringify(data)}`);
                }
            });

            this.publicWSFeed.on('error', (err: Error) => {
                logger.log(`WebSocket error: ${err.toString()}`);
            });

            this.publicWSFeed.on('close', (code: number, reason: string) => {
                logger.log(`WebSocket closed: ${code} - ${reason}`);

                setTimeout(() => {
                    if (this.pingInterval) clearInterval(this.pingInterval);
                    this.connect(onMessage);
                }, 1000);
            });
        });
    }

    public async stop() {
        if (this.pingInterval) clearInterval(this.pingInterval);

        if (this.publicWSFeed) {
            const unsubscribeMessage = JSON.stringify({
                op: 'unsubscribe',
                args: [
                    { channel: 'trades', instId: this.exchangeSymbol },
                    { channel: 'books5', instId: this.exchangeSymbol },
                    { channel: 'tickers', instId: this.exchangeSymbol }
                ]
            });

            this.publicWSFeed.send(unsubscribeMessage);
            this.publicWSFeed.close();
        }
    }

    private getEventType(message: any): SklEvent | null {
        if (message.arg && message.arg.channel) {
            switch (message.arg.channel) {
                case 'books5':
                    return 'TopOfBook';
                case 'trades':
                    return 'Trade';
                case 'tickers':
                    return 'Ticker';
            }
        }
        return null;
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {
        switch (event) {
            case 'TopOfBook':
                return [this.createTopOfBook(message.data[0], group)];
            case 'Trade':
                return message.data.map((trade: OkxTrade) => this.createTrade(trade, group));
            case 'Ticker':
                return [this.createTicker(message.data[0], group)];
            default:
                return [];
        }
    }

    private createTopOfBook(marketDepth: OkxMarketDepth, group: ConnectorGroup): TopOfBook {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Okx',
            event: 'TopOfBook',
            timestamp: parseInt(marketDepth.ts),
            askPrice: parseFloat(marketDepth.asks[0][0]),
            askSize: parseFloat(marketDepth.asks[0][1]),
            bidPrice: parseFloat(marketDepth.bids[0][0]),
            bidSize: parseFloat(marketDepth.bids[0][1]),
        };
    }

    private createTicker(ticker: OkxTicker, group: ConnectorGroup): Ticker {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Okx',
            event: 'Ticker',
            lastPrice: parseFloat(ticker.last),
            timestamp: parseInt(ticker.ts),
        };
    }

    private createTrade(trade: OkxTrade, group: ConnectorGroup): Trade {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Okx',
            event: 'Trade',
            price: parseFloat(trade.px),
            size: parseFloat(trade.sz),
            side: OkxSideMap[trade.side as keyof typeof OkxSideMap],
            timestamp: parseInt(trade.ts),
        };
    }
}