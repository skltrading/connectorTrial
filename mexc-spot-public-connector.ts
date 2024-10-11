import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, SklEvent, Ticker, TopOfBook, Trade } from "../../types";
import { getSklSymbol } from "../../util/config";
import { Logger } from "../../util/logging";
import { getMexcSymbol, MexcSideMap } from "./mexc-spot";
import { WebSocket } from 'ws'

const logger = Logger.getInstance('mexc-spot-public-connector');

export interface MexcMarketDepth {
    d: {
        asks: Array<{ p: string, v: string }>;
        bids: Array<{ p: string, v: string }>;
    }
    s: string;
    t: number;
}

export interface MexcTicker {
    d: { p: string };
    symbol: string;
    t: number;
}

export interface MexcTradeMessage {
    s: string;
    d: {
        deals: Array<MexcTrade>
    }
    t: number;
}

export interface MexcTrade { p: string, S: number, v: string, t: number };

export class MexcSpotPublicConnector implements PublicExchangeConnector {

    public publicWebsocketAddress = 'wss://wbs.mexc.com/ws';

    public publicWSFeed: any;

    private pingInterval: any;

    private exchangeSymbol: string;

    private sklSymbol: string;

    constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        const self = this
        self.exchangeSymbol = getMexcSymbol(self.group, self.config);
        self.sklSymbol = getSklSymbol(self.group, self.config);
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {

        return new Promise(async (resolve) => {

            logger.log(`Attempting to connext to MEXC`);

            const url = this.publicWebsocketAddress;

            this.publicWSFeed = socket || new WebSocket(url);

            this.publicWSFeed.on('open', () => {

                const message = JSON.stringify({
                    'method': 'SUBSCRIPTION',
                    'params': [
                        `spot@public.deals.v3.api@${this.exchangeSymbol}`,
                        `spot@public.limit.depth.v3.api@${this.exchangeSymbol}@5`,
                        `spot@public.miniTicker.v3.api@${this.exchangeSymbol}@UTC+0`
                    ]
                });

                this.publicWSFeed.send(message);

                this.pingInterval = setInterval(() => {

                    console.log('Pinging MEXC');

                    this.publicWSFeed.send(JSON.stringify({
                        "method": "PING"
                    }));

                }, 1000 * 10)

                resolve(true);

            });

            this.publicWSFeed.onmessage = (message: { data: any; }) => {

                const data = JSON.parse(message.data);

                const actionType: SklEvent | null = this.getEventType(data)

                if (actionType) {

                    const serializableMessages: Serializable[] = this.createSklEvent(actionType, data, this.group)

                    onMessage(serializableMessages);

                } else {

                    logger.log(`No handler for message: ${JSON.stringify(data)}`)

                }

            }

            this.publicWSFeed.on('error', function error(err: any) {

                logger.log(`WebSocket error: ${err.toString()}`);

            });

            this.publicWSFeed.on('close', (code, reason) => {

                logger.log(`WebSocket closed: ${code} - ${reason}`);

                setTimeout(() => {

                    clearInterval(this.pingInterval);

                    this.connect(onMessage)

                }, 1000);

            });

            if (this.publicWSFeed.__init !== undefined) {

                this.publicWSFeed.__init();

            }

        });

    }

    public async stop() {

        clearInterval(this.pingInterval);

        const message = JSON.stringify({
            'op': 'UNSUBSCRIPTION',
            'params': [
                `spot@public.deals.v3.api@${this.exchangeSymbol}`,
                `spot@public.limit.depth.v3.api@${this.exchangeSymbol}@5`,
                `spot@public.miniTicker.v3.api@${this.exchangeSymbol}@UTC+0`
            ]
        });

        this.publicWSFeed.send(message);
    }

    private getEventType(message: any): SklEvent | null {

        const event = message;

        if (event !== undefined && event.c !== undefined) {

            if (message.c.startsWith('spot@public.limit.depth.v3.api')) {

                return 'TopOfBook'

            } else if (message.c.startsWith('spot@public.deals.v3.api')) {

                return 'Trade'

            } else if (message.c.startsWith('spot@public.miniTicker.v3.api')) {

                return 'Ticker'

            }
        }

        return null
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {

        if (event === 'TopOfBook') {

            return [this.createTopOfBook(message, group)]

        }
        else if (event === 'Trade') {

            const trades = message.d.deals.sort((a: MexcTrade, b: MexcTrade) => b.t - a.t)

            return trades.map((trade: MexcTrade) => this.createTrade(trade, group))

        } else if (event === 'Ticker') {

            return [this.createTicker(message, group)]

        } else {

            return []

        }
    }

    private createTopOfBook(marketDepth: MexcMarketDepth, group: ConnectorGroup): TopOfBook {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Mexc',
            event: 'TopOfBook',
            timestamp: marketDepth.t,
            askPrice: parseFloat(marketDepth.d.asks[0].p),
            askSize: parseFloat(marketDepth.d.asks[0].v),
            bidPrice: parseFloat(marketDepth.d.bids[0].p),
            bidSize: parseFloat(marketDepth.d.bids[0].v),
        };
    }

    private createTicker(trade: MexcTicker, group: ConnectorGroup): Ticker {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Mexc',
            event: 'Ticker',
            lastPrice: parseFloat(trade.d.p),
            timestamp: trade.t * 1000,
        };
    }

    private createTrade(trade: MexcTrade, group: ConnectorGroup): Trade | null {

        const tradeSide: number | undefined = trade.S;

        if (tradeSide) {
            return {
                symbol: this.sklSymbol,
                connectorType: 'Mexc',
                event: 'Trade',
                price: parseFloat(trade.p),
                size: parseFloat(trade.v),
                side: MexcSideMap[tradeSide],
                timestamp: trade.t * 1000,
            }
        } else {

            return null;

        }
    }

}