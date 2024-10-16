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
    BatchOrdersRequest
} from "../../types";

import { Logger } from "../../util/logging";
import CryptoJS from 'crypto-js';
import axios, { AxiosStatic } from 'axios';
import { WebSocket } from 'ws'
import { getOkxSymbol, OkxInvertedSideMap, OkxSideMap, OkxStringSideMap } from "./okx-spot";
import { getSklSymbol } from "../../util/config";

const logger = Logger.getInstance('okx-spot-private-connector');

export type OkxOrderType = 'limit' | 'market' | 'post_only' | 'fok' | 'ioc';

const OkxWSOrderUpdateStateMap: { [key: string]: OrderState } = {
    'live': 'Placed',
    'filled': 'Filled',
    'partially_filled': 'PartiallyFilled',
    'canceled': 'Cancelled',
};

const OkxOpenOrdersStateMap: { [key: string]: OrderState } = {
    'live': 'Placed',
    'partially_filled': 'PartiallyFilled',
};

const OkxOrderTypeMap: { [key: string]: OkxOrderType } = {
    'Limit': 'limit',
    'Market': 'market',
    'LimitMaker': 'post_only',
    'ImmediateOrCancel': 'ioc'
};

export class OkxSpotPrivateConnector implements PrivateExchangeConnector {
    public connectorId: string;
    public privateWebsocketAddress = 'wss://ws.okx.com:8443/ws/v5/private';
    public privateRestEndpoint = 'https://www.okx.com';
    public privateWSFeed: WebSocket | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private axios: AxiosStatic;
    private exchangeSymbol: string;
    private sklSymbol: string;

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential
    ) {
        this.exchangeSymbol = getOkxSymbol(this.group, this.config);
        this.sklSymbol = getSklSymbol(this.group, this.config);
        this.axios = axios;
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {
        return new Promise(async (resolve) => {
            this.privateWSFeed = socket || new WebSocket(this.privateWebsocketAddress);

            this.privateWSFeed.on('open', () => {
                const timestamp = Date.now() / 1000;
                const method = 'GET';
                const requestPath = '/users/self/verify';
                const sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${timestamp}${method}${requestPath}`, this.credential.secret));

                const loginMessage = JSON.stringify({
                    op: 'login',
                    args: [{
                        apiKey: this.credential.key,
                        passphrase: this.credential.passphrase,
                        timestamp,
                        sign
                    }]
                });

                this.privateWSFeed!.send(loginMessage);
            });

            this.privateWSFeed.on('message', (data: WebSocket.Data) => {
                const message = JSON.parse(data.toString());

                if (message.event === 'login' && message.code === '0') {
                    const subscribeMessage = JSON.stringify({
                        op: 'subscribe',
                        args: [
                            { channel: 'orders', instType: 'SPOT' },
                            { channel: 'account', instType: 'SPOT' }
                        ]
                    });
                    this.privateWSFeed!.send(subscribeMessage);

                    this.pingInterval = setInterval(() => {
                        console.log('Pinging OKX');
                        this.privateWSFeed!.send('ping');
                    }, 1000 * 15);

                    resolve(true);
                } else {
                    const actionType: SklEvent | null = this.getEventType(message);
                    if (actionType) {
                        const serializableMessages: Serializable[] = this.createSklEvent(actionType, message, this.group);
                        onMessage(serializableMessages);
                    } else {
                        logger.log(`No handler for message: ${JSON.stringify(message)}`);
                    }
                }
            });

            this.privateWSFeed.on('error', (err: Error) => {
                logger.log(`WebSocket error: ${err.toString()}`);
            });

            this.privateWSFeed.on('close', (code: number, reason: string) => {
                logger.log(`WebSocket closed: ${code} - ${reason}`);
                setTimeout(() => {
                    if (this.pingInterval) clearInterval(this.pingInterval);
                    this.connect(onMessage);
                }, 1000);
            });
        });
    }

    public async stop(cancelOrders = true) {
        if (this.pingInterval) clearInterval(this.pingInterval);

        if (this.privateWSFeed) {
            const unsubscribeMessage = JSON.stringify({
                op: 'unsubscribe',
                args: [
                    { channel: 'orders', instType: 'SPOT' },
                    { channel: 'account', instType: 'SPOT' }
                ]
            });
            this.privateWSFeed.send(unsubscribeMessage);
            this.privateWSFeed.close();
        }

        if (cancelOrders === true && this.exchangeSymbol !== undefined) {
            const event = 'CancelOrdersRequest';
            return await this.deleteAllOrders({
                connectorType: this.config.connectorType,
                event,
                symbol: this.exchangeSymbol,
                timestamp: new Date().getTime(),
            });
        }
    }

    public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
        const orders = await this.getRequest('/api/v5/trade/orders-pending', {
            instId: this.exchangeSymbol
        });

        logger.log(`RPC Response: OpenOrdersResponse -> ${JSON.stringify(orders)}`);

        if (orders.data) {
            return orders.data.map((o: any) => {
                return <OrderStatusUpdate>{
                    event: 'OrderStatusUpdate',
                    connectorType: 'Okx',
                    symbol: this.sklSymbol,
                    orderId: o.ordId,
                    sklOrderId: o.clOrdId,
                    state: OkxOpenOrdersStateMap[o.state],
                    side: OkxStringSideMap[o.side],
                    price: parseFloat(o.px),
                    size: parseFloat(o.sz),
                    notional: parseFloat(o.px) * parseFloat(o.sz),
                    filled_price: parseFloat(o.avgPx),
                    filled_size: parseFloat(o.accFillSz),
                    timestamp: parseInt(o.cTime)
                };
            });
        }

        return [];
    }

    public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
        const result = await this.getRequest('/api/v5/account/balance', {});

        const baseAsset = this.group.name;
        const quoteAsset = this.config.quoteAsset;

        const balances = result.data[0].details;
        const base = balances.find((b: any) => b.ccy === baseAsset) || { cashBal: '0', frozenBal: '0' };
        const quote = balances.find((b: any) => b.ccy === quoteAsset) || { cashBal: '0', frozenBal: '0' };

        const baseVal = parseFloat(base.cashBal) + parseFloat(base.frozenBal);
        const baseValue = baseVal * request.lastPrice;
        const quoteValue = parseFloat(quote.cashBal) + parseFloat(quote.frozenBal);

        const whole = baseValue + quoteValue;
        const pairPercentage = (baseValue / whole) * 100;

        return {
            event: "BalanceRequest",
            symbol: this.sklSymbol,
            baseBalance: baseVal,
            quoteBalance: quoteValue,
            inventory: pairPercentage,
            timestamp: new Date().getTime()
        };
    }

    public async placeOrders(request: BatchOrdersRequest): Promise<any> {
        const orders = request.orders.map(o => {
            const side = OkxInvertedSideMap[o.side];
            const ordType = OkxOrderTypeMap[o.type];
            return {
                instId: this.exchangeSymbol,
                tdMode: 'cash',
                side,
                ordType,
                sz: o.size.toFixed(8),
                px: o.price.toFixed(8),
            };
        });

        const batches = this.chunkArray(orders, 20);

        const pArray = batches.map(batch => {
            return this.postRequest('/api/v5/trade/batch-orders', {
                orders: batch
            });
        });

        const [completedBatches] = await Promise.all(pArray);
        logger.log(`Place order result: ${JSON.stringify(completedBatches)}`);
        if (completedBatches.data.some((b: any) => b.sCode !== '0')) {
            return Promise.reject(`At least one order in batch failed: ${JSON.stringify(completedBatches)}`);
        } else {
            return completedBatches.data;
        }
    }

    public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
        return await this.postRequest('/api/v5/trade/cancel-all', {
            instId: this.exchangeSymbol
        });
    }

    private getEventType(message: any): SklEvent | null {
        if (message.event === 'error') {
            logger.log(`Error response: ${message.code} - ${message.msg}`);
            return null;
        } else if (message.arg && message.arg.channel === 'orders') {
            return 'OrderStatusUpdate';
        } else {
            return null;
        }
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {
        if (event === 'OrderStatusUpdate') {
            return message.data.map((order: any) => this.createOrderStatusUpdate(event, order, group));
        } else {
            return [];
        }
    }

    private createOrderStatusUpdate(action: SklEvent, order: any, group: ConnectorGroup): OrderStatusUpdate {
        const state: OrderState = OkxWSOrderUpdateStateMap[order.state];
        const side: Side = OkxSideMap[order.side];

        return {
            symbol: this.sklSymbol,
            connectorType: 'Okx',
            event: action,
            state,
            orderId: order.ordId,
            sklOrderId: order.clOrdId,
            side,
            price: parseFloat(order.px),
            size: parseFloat(order.sz),
            notional: parseFloat(order.px) * parseFloat(order.sz),
            filled_price: parseFloat(order.avgPx),
            filled_size: parseFloat(order.accFillSz),
            timestamp: parseInt(order.uTime)
        };
    }

    private async getRequest(route: string, params: any): Promise<any> {
        const timestamp = Date.now() / 1000;
        const method = 'GET';
        const requestPath = `/api/v5${route}`;
        
        let queryString = '';
        if (Object.keys(params).length > 0) {
            queryString = '?' + new URLSearchParams(params).toString();
        }

        const sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${timestamp}${method}${requestPath}${queryString}`, this.credential.secret));

        const headers = {
            'OK-ACCESS-KEY': this.credential.key,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp.toString(),
            'OK-ACCESS-PASSPHRASE': this.credential.passphrase,
        };

        try {
            const result = await this.axios.get(`${this.privateRestEndpoint}${requestPath}${queryString}`, { headers });
            return result.data;
        } catch (error) {
            console.log(error);
        }
    }

    private async postRequest(route: string, params: any): Promise<any> {
        const timestamp = Date.now() / 1000;
        const method = 'POST';
        const requestPath = `/api/v5${route}`;
        
        const body = JSON.stringify(params);

        const sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${timestamp}${method}${requestPath}${body}`, this.credential.secret));

        const headers = {
            'OK-ACCESS-KEY': this.credential.key,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp.toString(),
            'OK-ACCESS-PASSPHRASE': this.credential.passphrase,
            'Content-Type': 'application/json'
        };

        try {
            const result = await this.axios.post(`${this.privateRestEndpoint}${requestPath}`, body, { headers });
            return result.data;
        } catch (error) {
            logger.log(`POST Error: ${error.toString()}`);
        }
    }

    private chunkArray(array: any[], chunkSize: number): any[] {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}