import * as Types from "./types"
// import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, SklEvent, Ticker, TopOfBook, Trade } from "../../types";
// import { Serializable } from "child_process";
// import { getSklSymbol } from "../../util/config";
// import { Logger } from "../../util/logging";
import { getBitgetSymbol, BitgetSideMap } from "./bitget-spot";
import { WebSocket } from 'ws'

// const logger = Logger.getInstance('Bitget-spot-public-connector');

export interface BitgetMarketDepth {
    d: {
        asks: Array<{ p: string, v: string }>;
        bids: Array<{ p: string, v: string }>;
    }
    s: string;
    t: number;
}

// export interface BitgetTradeMessage {
//     s: string;
//     d: {
//         deals: Array<BitgetTrade>
//     }
//     t: number;
// }

// export interface BitgetTrade { p: string, S: number, v: string, t: number };

export class BitgetFuturesPublicConnector implements PublicExchangeConnector {

    public publicWebsocketAddress = 'wss://ws.bitget.com/spot/v1/stream';
    // public publicWebsocketAddress = 'wss://ws.bitget.com/v2/ws/public';

    private retryCount = 0;
    public publicWSFeed: any;

    private pingInterval: any;

    // private exchangeSymbol: string;
    private channelArguments: Types.channelRequest;
    // =  {
    //     instType: "SP",
    //     channel: "candle1m",
    //     instId: "BTC-USDT",
    //     };

    private sklSymbol: string;

    constructor() {
    // constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        // const self = this
        // self.exchangeSymbol = getBitgetSymbol(self.group, self.config);

        // Define which channels to subscribe to
        this.channelArguments = {
            args: [{
                instType: "sp",
                channel: "trade",
                instId: "ETHUSDT",
            }],
        };
        this.sklSymbol = "SKL";
        // self.sklSymbol = getSklSymbol(self.group, self.config);

    }

    public async connect(onMessage: (m: Types.Serializable[]) => void, socket = undefined): Promise<any> {
    // public async connect(socket = undefined): Promise<any> {

        return new Promise(async (resolve, reject) => {

            console.log(`Attempting to connect to Bitget`);

            const url = this.publicWebsocketAddress;

            this.publicWSFeed = socket || new WebSocket(url);

            this.publicWSFeed.on('open', () => {
                try {
                    // Hardcoding values for now but this can be obtained via props
                    setTimeout(() => {
                        // Hardcoding values for now but this can be obtained via props
                        this.subscribeToChannels()
                    }, 1000)
                    this.retryCount = 0;
                } catch (err) {
                    console.error(`Error while connecting to WebSocket: ${err}`);
                }
                // try {

                // const message = JSON.stringify({
                //     'method': 'SUBSCRIPTION',
                //     'params': [
                //         `spot@public.deals.v3.api@${this.exchangeSymbol}`,
                //         `spot@public.limit.depth.v3.api@${this.exchangeSymbol}@5`,
                //         `spot@public.miniTicker.v3.api@${this.exchangeSymbol}@UTC+0`
                //     ]
                // });

                // this.publicWSFeed.send(message);

                // this.pingInterval = setInterval(() => {

                //     console.log('Pinging Bitget');

                //     this.publicWSFeed.send(JSON.stringify({
                //         "method": "PING"
                //     }));

                // }, 1000 * 10)

                // resolve(true);
                // } catch (err: any) {
                //     logger.error(`Error during WebSocket open event: ${err.message}`);
                //     reject(err);
                // }
            }
            );

            this.publicWSFeed.onmessage = (message: { data: any; }) => {

                try {
                    console.log(1)
                    const data = JSON.parse(message.data);
                    console.log(2)
                    const actionType: Types.SklEvent | null = this.getEventType(data)
                    console.log(3)
                    this.handleMessage(data, onMessage)
                    console.log(4)
                } catch (err) {
                    console.error(`Error processing WebSocket message: ${err}`);
                }

            }

            this.publicWSFeed.on('error', function error(err: any) {
                console.log(`WebSocket error: ${err.toString()}`);
            });

            this.publicWSFeed.on('close', (code: any, reason: any) => {

                console.log(`WebSocket closed: ${code} - ${reason}`);

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

        const message = {
            op: "unsubscribe",
            args: this.channelArguments.args,
        };

        this.publicWSFeed.send(JSON.stringify(message));
        this.publicWSFeed.close();
    }


    private subscribeToChannels(): void {

        const subscriptionMessage = {
            op: 'subscribe',
            args: this.channelArguments.args,
        };

        this.publicWSFeed.send(JSON.stringify(subscriptionMessage));
        console.log('Subscribed to channels:', this.channelArguments.args);
    }

    private handleMessage(data: string, onMessage: (messages: Types.Serializable[]) => void): void {
        console.log("HandleMessage1");
        console.log("DATA: ", data);
        var message;
        try {
            message = JSON.parse(JSON.stringify(data));
        } catch (error) {
            console.error("Failed to parse JSON:", error);
            console.log("DATA: ", data);
            return;
        }
        console.log("HandleMessage2");
        const eventType = this.getEventType(message);
        console.log("EVENTTYPE: ", eventType);
        console.log("HandleMessage3");
    
        if (eventType) {
            const serializableMessages = this.createSerializableEvents(eventType, message);
            if (serializableMessages.length > 0) {
                console.log("onMessage(serializableMessages)");
                console.log(serializableMessages);
                onMessage(serializableMessages);
            }
        } else {
            // Log unrecognized messages
        }
    }

    private createSerializableEvents(eventType: Types.SklEvent, eventData: Types.BitgetEventData): Types.Serializable[] {
        switch (eventType) {
            case 'Trade': {
                // const trade = ({
                //     ts: eventData.data[0][0],
                //     px: eventData.data[0][1],
                //     sz: eventData.data[0][2],
                //     side: eventData.data[0][3],
                // })
                // const trades = trade as unknown as Types.BitgetTrade

                //TODO: Iterate over data array
                const trade: Types.BitgetTrade = {
                    instType: eventData.arg.instType,
                    channel: eventData.arg.channel,
                    instId: eventData.arg.instId,
                    timestamp: Number(eventData.data[0][0]),
                    price: eventData.data[0][1],
                    size: eventData.data[0][2],
                    side: eventData.data[0][3]
                }
                //  eventData.params.data as unknown as Types.BitgetTrade[]
                // return trade.map((trade: Types.BitgetTrade) => this.createTrade(trade)).filter((trade) => trade !== null)
                return [this.createTrade(trade)].filter((e) => e !== null);
            }
            case 'Ticker': {
                const ticker = eventData.params.data as unknown as Types.BitgetTicker
                return [this.createTicker(ticker)].filter((e) => e !== null);
            }
            default:
                return [];
        }
    }

    private getEventType(message: any): Types.SklEvent | null {
        if (message.arg.channel === 'trade') {
            return 'Trade';
        }  else if (message.arg.channel === 'ticker') {
            return 'Ticker';
        } else if (message.op === 'subscription') {
            console.info(`Subscription confirmed: ${JSON.stringify(message)}`);
            return null;
        } else if (message.event === 'error') {
            console.error(`Error message received: ${message.error}`);
            return null;
        }
        return null;
    }

    // private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {

    //     if (event === 'TopOfBook') {

    //         return [this.createTopOfBook(message, group)]

    //     }
    //     else if (event === 'Trade') {

    //         const trades = message.d.deals.sort((a: BitgetTrade, b: BitgetTrade) => b.t - a.t)

    //         return trades.map((trade: BitgetTrade) => this.createTrade(trade, group))

    //     } else if (event === 'Ticker') {

    //         return [this.createTicker(message, group)]

    //     } else {

    //         return []

    //     }
    // }

    private createTopOfBook(marketDepth: BitgetMarketDepth, group: ConnectorGroup): TopOfBook {
        return {
            symbol: this.sklSymbol,
            connectorType: 'Bitget',
            event: 'TopOfBook',
            timestamp: marketDepth.t,
            askPrice: parseFloat(marketDepth.d.asks[0].p),
            askSize: parseFloat(marketDepth.d.asks[0].v),
            bidPrice: parseFloat(marketDepth.d.bids[0].p),
            bidSize: parseFloat(marketDepth.d.bids[0].v),
        };
    }

    private createTicker(ticker: Types.BitgetTicker): Ticker {
        return {
            event: 'Ticker',
            connectorType: 'Bitget',
            symbol: ticker.arg.instId,
            lastPrice: parseFloat(ticker.data[0].last),
            timestamp: ticker.data[0].ts * 1000,
        };
    }

    private createTrade(trade: Types.BitgetTrade): Types.SklTrade | null {
        console.log("createTrade");
        console.log(trade);
        const tradeSide: string | undefined = trade.side
        if (tradeSide) {
            return {
                event: 'Trade',
                connectorType: 'Bitget',
                symbol: trade.instId,
                price: Number(trade.price),
                size: Number(trade.size),
                side: BitgetSideMap[trade.side],
                timestamp: (new Date(trade.timestamp)).getTime(),
            }
        } else {
            return null
        }
    }

    // private createTrade(trade: BitgetTrade, group: ConnectorGroup): Trade | null {

    //     const tradeSide: number | undefined = trade.S;

    //     if (tradeSide) {
    //         return {
    //             symbol: this.sklSymbol,
    //             connectorType: 'Bitget',
    //             event: 'Trade',
    //             price: parseFloat(trade.p),
    //             size: parseFloat(trade.v),
    //             side: BitgetSideMap[tradeSide],
    //             timestamp: trade.t * 1000,
    //         }
    //     } else {

    //         return null;

    //     }
    // }

}