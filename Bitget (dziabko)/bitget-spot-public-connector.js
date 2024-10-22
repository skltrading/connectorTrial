"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitgetSpotPublicConnector = void 0;
// import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, SklEvent, Ticker, TopOfBook, Trade } from "../../types";
// import { Serializable } from "child_process";
// import { getSklSymbol } from "../../util/config";
// import { Logger } from "../../util/logging";
const bitget_spot_1 = require("./bitget-spot");
const ws_1 = require("ws");
// export interface BitgetTradeMessage {
//     s: string;
//     d: {
//         deals: Array<BitgetTrade>
//     }
//     t: number;
// }
// export interface BitgetTrade { p: string, S: number, v: string, t: number };
class BitgetSpotPublicConnector {
    constructor() {
        // constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        // const self = this
        // self.exchangeSymbol = getBitgetSymbol(self.group, self.config);
        this.publicWebsocketAddress = 'wss://ws.bitget.com/spot/v1/stream';
        // public publicWebsocketAddress = 'wss://ws.bitget.com/v2/ws/public';
        this.retryCount = 0;
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
    connect(onMessage_1) {
        return __awaiter(this, arguments, void 0, function* (onMessage, socket = undefined) {
            // public async connect(socket = undefined): Promise<any> {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                console.log(`Attempting to connect to Bitget`);
                const url = this.publicWebsocketAddress;
                this.publicWSFeed = socket || new ws_1.WebSocket(url);
                this.publicWSFeed.on('open', () => {
                    try {
                        // Hardcoding values for now but this can be obtained via props
                        setTimeout(() => {
                            // Hardcoding values for now but this can be obtained via props
                            this.subscribeToChannels();
                        }, 1000);
                        this.retryCount = 0;
                    }
                    catch (err) {
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
                });
                this.publicWSFeed.onmessage = (message) => {
                    try {
                        console.log(1);
                        const data = JSON.parse(message.data);
                        console.log(2);
                        const actionType = this.getEventType(data);
                        console.log(3);
                        this.handleMessage(data, onMessage);
                        console.log(4);
                    }
                    catch (err) {
                        console.error(`Error processing WebSocket message: ${err}`);
                    }
                };
                this.publicWSFeed.on('error', function error(err) {
                    console.log(`WebSocket error: ${err.toString()}`);
                });
                this.publicWSFeed.on('close', (code, reason) => {
                    console.log(`WebSocket closed: ${code} - ${reason}`);
                    setTimeout(() => {
                        clearInterval(this.pingInterval);
                        this.connect(onMessage);
                    }, 1000);
                });
                if (this.publicWSFeed.__init !== undefined) {
                    this.publicWSFeed.__init();
                }
            }));
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.pingInterval);
            const message = {
                op: "unsubscribe",
                args: this.channelArguments.args,
            };
            this.publicWSFeed.send(JSON.stringify(message));
            this.publicWSFeed.close();
        });
    }
    subscribeToChannels() {
        const subscriptionMessage = {
            op: 'subscribe',
            args: this.channelArguments.args,
        };
        this.publicWSFeed.send(JSON.stringify(subscriptionMessage));
        console.log('Subscribed to channels:', this.channelArguments.args);
    }
    handleMessage(data, onMessage) {
        console.log("HandleMessage1");
        console.log("DATA: ", data);
        var message;
        try {
            message = JSON.parse(JSON.stringify(data));
        }
        catch (error) {
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
        }
        else {
            // Log unrecognized messages
        }
    }
    createSerializableEvents(eventType, eventData) {
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
                const trade = {
                    instType: eventData.arg.instType,
                    channel: eventData.arg.channel,
                    instId: eventData.arg.instId,
                    timestamp: Number(eventData.data[0][0]),
                    price: eventData.data[0][1],
                    size: eventData.data[0][2],
                    side: eventData.data[0][3]
                };
                //  eventData.params.data as unknown as Types.BitgetTrade[]
                // return trade.map((trade: Types.BitgetTrade) => this.createTrade(trade)).filter((trade) => trade !== null)
                return [this.createTrade(trade)].filter((e) => e !== null);
            }
            case 'Ticker': {
                const ticker = eventData.params.data;
                return [this.createTicker(ticker)].filter((e) => e !== null);
            }
            default:
                return [];
        }
    }
    getEventType(message) {
        if (message.arg.channel === 'trade') {
            return 'Trade';
        }
        else if (message.arg.channel === 'ticker') {
            return 'Ticker';
        }
        else if (message.op === 'subscription') {
            console.info(`Subscription confirmed: ${JSON.stringify(message)}`);
            return null;
        }
        else if (message.event === 'error') {
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
    createTopOfBook(marketDepth, group) {
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
    createTicker(ticker) {
        return {
            event: 'Ticker',
            connectorType: 'Bitget',
            symbol: ticker.arg.instId,
            lastPrice: parseFloat(ticker.data[0].last),
            timestamp: ticker.data[0].ts * 1000,
        };
    }
    createTrade(trade) {
        console.log("createTrade");
        console.log(trade);
        const tradeSide = trade.side;
        if (tradeSide) {
            return {
                event: 'Trade',
                connectorType: 'Bitget',
                symbol: trade.instId,
                price: Number(trade.price),
                size: Number(trade.size),
                side: bitget_spot_1.BitgetSideMap[trade.side],
                timestamp: (new Date(trade.timestamp)).getTime(),
            };
        }
        else {
            return null;
        }
    }
}
exports.BitgetSpotPublicConnector = BitgetSpotPublicConnector;
