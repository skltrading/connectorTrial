import {
    ConnectorConfiguration,
    ConnectorGroup,
    PrivateExchangeConnector,
    Serializable,
    SklEvent,
    Credential,
    OrderState,
    Side,
    OrderStatusUpdate,
    CancelOrdersRequest,
    OpenOrdersRequest,
    BalanceRequest,
    BalanceResponse,
    //BatchOrdersRequest
} from "../../types";

import { Logger } from "../../util/logging";
import CryptoJS from 'crypto-js';
import axios, { AxiosStatic } from 'axios';
import { WebSocket } from 'ws'
import { getSklSymbol } from "../../util/config";
import { BinanceInvertedSideMap, BinanceSideMap, BinanceStringSideMap, getBinanceSymbol } from "./binance-spot";
import { AllActiveOrder, AccountInfo, placeOrderData, OrderAckResponse, OrderResultResponse, OrderFullResponse, CancelSingleOrderData, BinanceOrderProgress } from "./types";

export type BinanceOrderType = 'LIMIT' | 'MARKET' | 'LIMIT_MAKER' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';

const BinanceWSOrderUpdateStateMap: { [key: string]: OrderState } = {
    '1': 'PENDING_NEW',
    '2': 'FILLED',
    '3': 'PARTIALLY_FILLED',
    '4': 'CANCELED',
    '5': 'EXPIRED',
}

const BinanceOpenOrdersStateMap: { [key: string]: OrderState } = {
    'NEW': 'Placed',
    'PARTIALLY_FILLED': 'PartiallyFilled',
}

const BinanceOrderTypeMap: { [key: string]: BinanceOrderType } = {
    'Limit': 'LIMIT',
    'Market': 'MARKET',
    'StopLoss': 'STOP_LOSS',
    'LimitMaker': 'LIMIT_MAKER',
    'TakeProfit': 'TAKE_PROFIT',
    'TakeProfitLimit': 'TAKE_PROFIT_LIMIT'
}



const logger = Logger.getInstance('binance-spot-private-connector');

export class BinanceSpotPrivateConnector implements PrivateExchangeConnector {
    public connectorId: string;

    public privateWebsocketAddress = 'wss://testnet.binance.vision/ws-api/v3';

    public privateRestEndpoint = 'https://testnet.binance.vision/api/v3';

    public privateWSFeed: any;

    private pingInterval: any;

    private pingUserDataStream: any;

    private axios: AxiosStatic;

    private exchangeSymbol: string;

    private sklSymbol: string;

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential
    ) {

        this.exchangeSymbol = getBinanceSymbol(this.group, this.config);
        this.sklSymbol = getSklSymbol(this.group, this.config);

        // remove this credential initialzation after testing
        this.credential = {
            apiKey: process.env.USER_BINANCE_API_KEY, // Example for an API key
            apiSecret: process.env.USER_BINANCE_SECRET, // Example for an API secret
        };
        this.axios = axios;
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {

        return new Promise(async (resolve, reject) => {

            try {
                const key = await this.safeGetListenKey();

                const url = this.privateWebsocketAddress + `/${key.listenKey}`;

                this.privateWSFeed = socket || new WebSocket(url);

                this.privateWSFeed.on('open', () => {

                    this.pingInterval = setInterval(() => {

                        Logger.log('Pinging Binance');

                        try {
                            this.privateWSFeed.send(JSON.stringify({
                                "method": "PING"
                            }));
                        } catch (err: any) {
                            Logger.log(`Error sending ping: ${err.toString()}`);
                        }

                    }, 1000 * 10)

                    this.pingUserDataStream = setInterval(() => {

                        Logger.log('Pinging binance to keep user data stream alive');

                        this.axios.put(`${this.privateRestEndpoint}/userDataStream`)
                            .catch((err) => {
                                Logger.log(`Error pinging user data stream: ${err.toString()}`);
                            });

                    }, 30 * 60 * 1000); // We need to ping Binance every 30 minutes to keep the user data stream alive

                    resolve(true);

                });

                this.privateWSFeed.onmessage = (message: { data: any; }) => {

                    try {
                        const data = JSON.parse(message.data);

                        const actionType: SklEvent | null = this.getEventType(data);

                        if (actionType) {

                            const serializableMessages: Serializable[] = this.createSklEvent(actionType, data, this.group);

                            onMessage(serializableMessages);

                        } else {

                            Logger.log(`No handler for message: ${JSON.stringify(data)}`);

                        }

                    } catch (err: any) {
                        Logger.log(`Error processing message: ${err.toString()}`);
                    }

                };

                this.privateWSFeed.on('error', function error(err: any) {

                    Logger.log(`WebSocket error: ${err.toString()}`);

                    // Reject promise on WebSocket error
                    reject(new Error(`WebSocket error: ${err.toString()}`));

                });

                this.privateWSFeed.on('close', (code: number, reason: string) => {

                    Logger.log(`WebSocket closed: ${code} - ${reason}`);

                    // Attempt to reconnect after a short delay
                    setTimeout(() => {
                        clearInterval(this.pingInterval);
                        clearInterval(this.pingUserDataStream);
                        this.connect(onMessage).catch(err => {
                            Logger.log(`Error reconnecting: ${err.toString()}`);
                        });
                    }, 1000);

                });

                if (this.privateWSFeed.__init !== undefined) {
                    this.privateWSFeed.__init();
                }

            } catch (err: any) {
                Logger.log(`Error in connection setup: ${err.toString()}`);
                reject(new Error(`Connection setup failed: ${err.toString()}`));
            }

        });

    }

    public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {

        const orders: AllActiveOrder = await this.getRequest('/openOrderList', {
            symbol: this.exchangeSymbol
        });

        logger.log(`RPC Response: OpenOrdersResponse -> ${JSON.stringify(orders)}`)

        if (orders !== undefined) {

            return orders.map((o) => {
                return <OrderStatusUpdate>{
                    event: 'OrderStatusUpdate',
                    connectorType: 'Binance',
                    symbol: this.sklSymbol,
                    orderId: o.orderId,
                    sklOrderId: o.clientOrderId,
                    state: BinanceOpenOrdersStateMap[o.status],
                    side: BinanceStringSideMap[o.side],
                    price: parseFloat(o.price),
                    size: parseFloat(o.origQty),
                    notional: parseFloat(o.price) * parseFloat(o.origQty),
                    filled_price: parseFloat(o.price),
                    filled_size: parseFloat(o.executedQty),
                    timestamp: o.time
                }
            })
        }

        return [];

    }

    public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
        const self = this
        const result: AccountInfo = await this.getRequest('/account', {});

        const baseAsset = self.group.name
        const quoteAsset = self.config.quoteAsset
        // console.log(baseAsset);

        const usdt = result.balances.find(d => d.asset === quoteAsset) || { free: '0', locked: '0' };

        const base = result.balances.find(d => d.asset === baseAsset) || { free: '0', locked: '0' };

        const baseVal = parseFloat(base.free) + parseFloat(base.locked);

        const baseValue = parseFloat(<any>(baseVal * request.lastPrice));

        const usdtValue = parseFloat(usdt.free) + parseFloat(usdt.locked);

        const whole = parseFloat(<any>baseValue) + usdtValue;

        const pairPercentage = (baseValue / whole) * 100;

        return {
            event: "BalanceRequest",
            symbol: this.sklSymbol,
            baseBalance: baseVal,
            quoteBalance: usdtValue,
            inventory: pairPercentage,
            timestamp: new Date().getTime()
        }
    }

    public async placeOrders(data: placeOrderData): Promise<any> {
        const self = this

        const side = BinanceInvertedSideMap[data.side];
        const type = BinanceOrderTypeMap[data.type];
        const order = {
            symbol: self.exchangeSymbol,
            quantity: data.quantity.toFixed(8),
            price: data.price.toFixed(8),
            side,
            type,
        };

        try {
            const response = await this.postRequest('/order', order);

            if (data.newOrderRespType === 'ACK') {
                const ackResponse = response as unknown as OrderAckResponse;
                console.log('Order acknowledged:', ackResponse);
                return ackResponse;

            } else if (data.newOrderRespType === 'RESULT') {
                const resultResponse = response as unknown as OrderResultResponse;
                console.log('Order result:', resultResponse);
                return resultResponse;

            } else if (data.newOrderRespType === 'FULL') {
                const fullResponse = response as unknown as OrderFullResponse;
                console.log('Order full response:', fullResponse);
                return fullResponse;

            } else {
                throw new Error('Unknown response type');
            }

        } catch (error: any) {
            logger.error('API Error:', error);
        }
    }

    public async deleteOneOrder(request: CancelSingleOrderData): Promise<any> {
        const self = this
        return await self.deleteRequest('/order', request);
    }

    public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
        const self = this
        return await self.deleteRequest('/openOrders', {
            symbol: self.exchangeSymbol
        });
    }

    private getEventType(message: any): SklEvent | null {

        if ('code' in message && 'msg' in message) {
            logger.log(`Subscription response: ${message.code} - ${message.msg}`)
            return null
        } else if ('e' in message) {
            if (message.e === "executionReport") {
                return 'OrderStatusUpdate'
            }
        } else {
            return null
        }
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {

        if (event === 'OrderStatusUpdate') {
            const executionReport: BinanceOrderProgress = message;
            return [this.createOrderStatusUpdate(event, executionReport, group)]

        } else {

            return [];

        }
    }

    private createOrderStatusUpdate(action: SklEvent, order: BinanceOrderProgress, group: ConnectorGroup): OrderStatusUpdate {

        const state: OrderState = BinanceWSOrderUpdateStateMap[order.X]

        const side: Side = BinanceSideMap[order.S]

        return {
            symbol: this.sklSymbol,
            connectorType: 'Binance',
            event: action,
            state,
            orderId: order.i,
            sklOrderId: order.e,
            side,
            price: order.p,
            size: order.q,
            notional: order.p * order.q,
            filled_price: order.Z / order.z,
            filled_size: order.z,
            timestamp: order.E
        }
    }

    private async safeGetListenKey() {

        const keys = await this.getRequest('/userDataStream', {});

        if (keys && keys.listenKey !== undefined) {

            console.log('Roating Keys, found', keys);

            keys.forEach(async (key: string) => {
                await this.deleteRequest('/userDataStream', { listenKey: key });
            })

        }

        return await this.postRequest('/userDataStream', {});

    }

    private async getRequest(route: string, params: any): Promise<any> {

        const now = Date.now()

        let body = '';

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap: any[] = [];

            Object.keys(params).forEach(k => {

                pMap.push(`${k}=${params[k]}`);

            });

            body = pMap.join('&');

        }

        const signature = CryptoJS
            .HmacSHA256(body, this.credential.secret);
        params.signature = signature;

        const header = {
            'Content-Type': 'application/json',
            'X-MBX-APIKEY': this.credential.key,
        }

        try {

            const result = await this.axios.get(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                headers: header
            });

            return result.data;

        } catch (error) {
            logger.log("error sending a get request ", error);
        }

    }

    private async deleteRequest(route: string, params: any): Promise<any> {

        const now = Date.now();

        let body = '';

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap: any = [];

            Object.keys(params).forEach(k => {

                pMap.push(`${k}=${params[k]}`);

            });

            body = pMap.join('&');

        }

        const signature = CryptoJS
            .HmacSHA256(body, this.credential.secret);

        params.signature = signature;

        const header = {
            'Content-Type': 'application/json',
            'X-MBX-APIKEY': this.credential.key,
        }

        try {
            const result = await this.axios.delete(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                headers: header
            });

            return result.data;

        } catch (error) {
            logger.log("error sending a delete request ", error);
        }

    }

    private async postRequest(route: string, params: any): Promise<any> {

        const now = Date.now();

        let body = undefined;

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap: any = [];

            Object.keys(params).forEach(k => {
                pMap.push(`${k}=${params[k]}`);
            });

            body = pMap.join('&');

        }

        const signature = CryptoJS
            .HmacSHA256(body, this.credential.secret)
        params.signature = signature;

        const header = {
            'Content-Type': 'application/json',
            'X-MBX-APIKEY': this.credential.key,
        }

        try {

            const result = await this.axios.post(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                headers: header
            });

            return result.data;

        } catch (error) {
            logger.log("error sending a post request ", error);
        }

    }

}