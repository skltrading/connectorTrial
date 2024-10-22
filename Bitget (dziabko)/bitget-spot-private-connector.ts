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
import { getBitgetSymbol, BitgetInvertedSideMap, BitgetSideMap, BitgetStringSideMap } from "./bitget-spot";
import { getSklSymbol } from "../../util/config";

export interface BitgetOrderProgress {
    d: {
        s: any;
        S: any;
        i: any;
        c: any;
        p: any;
        v: any;
        ap: any;
        a: any;
        t: any;
    }
    t: string;
}

export type BitgetOrderType = 'LIMIT' | 'MARKET' | 'LIMIT_MAKER' | 'IMMEDIATE_OR_CANCEL';

const BitgetWSOrderUpdateStateMap: { [key: string]: OrderState } = {
    '1': 'Placed',
    '2': 'Filled',
    '3': 'PartiallyFilled',
    '4': 'Cancelled',
    '5': 'CancelledPartiallyFilled',
}

const BitgetOpenOrdersStateMap: { [key: string]: OrderState } = {
    'NEW': 'Placed',
    'PARTIALLY_FILLED': 'PartiallyFilled',
}

const BitgetOrderTypeMap: { [key: string]: BitgetOrderType } = {
    'Limit': 'LIMIT',
    'Market': 'MARKET',
    'LimitMaker': 'LIMIT_MAKER',
    'ImmediateOrCancel': 'IMMEDIATE_OR_CANCEL'
}

const logger = Logger.getInstance('Bitget-spot-private-connector')

export class BitgetSpotPrivateConnector implements PrivateExchangeConnector {

    public connectorId: string;

    public privateWebsocketAddress = 'wss://ws.bitget.com/v2/ws/private';

    public privateRestEndpoint = 'https://api.Bitget.com/api/v3';

    public privateWSFeed: any;

    private pingInterval: any;

    private axios: AxiosStatic;

    private exchangeSymbol: string;

    private sklSymbol: string;

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential
    ) {
        const self = this
        self.exchangeSymbol = getBitgetSymbol(self.group, self.config);
        self.sklSymbol = getSklSymbol(self.group, self.config);

        self.axios = axios;
    }

    public async connect(onMessage: (m: Serializable[]) => void, socket = undefined): Promise<any> {

        return new Promise(async (resolve) => {

            const key = await this.safeGetListenKey();

            const url = this.privateWebsocketAddress + `?listenKey=${key.listenKey}`;

            this.privateWSFeed = socket || new WebSocket(url);

            this.privateWSFeed.on('open', () => {

                const message = JSON.stringify({
                    'method': 'SUBSCRIPTION',
                    'params': [
                        'spot@private.deals.v3.api',
                        'spot@private.orders.v3.api'
                    ]
                });

                this.privateWSFeed.send(message);

                this.pingInterval = setInterval(() => {

                    console.log('Pinging Bitget');

                    this.privateWSFeed.send(JSON.stringify({
                        "method": "PING"
                    }));

                }, 1000 * 10)

                resolve(true);

            });

            this.privateWSFeed.onmessage = (message: { data: any; }) => {

                const data = JSON.parse(message.data);

                const actionType: SklEvent | null = this.getEventType(data)

                if (actionType) {

                    const serializableMessages: Serializable[] = this.createSklEvent(actionType, data, this.group)

                    onMessage(serializableMessages);

                } else {

                    logger.log(`No handler for message: ${JSON.stringify(data)}`)

                }

            }

            this.privateWSFeed.on('error', function error(err: any) {

                logger.log(`WebSocket error: ${err.toString()}`);

            });

            this.privateWSFeed.on('close', (code, reason) => {

                logger.log(`WebSocket closed: ${code} - ${reason}`);

                setTimeout(() => {

                    clearInterval(this.pingInterval);

                    this.connect(onMessage)

                }, 1000);

            });

            if (this.privateWSFeed.__init !== undefined) {

                this.privateWSFeed.__init();

            }

        });

    }

    public async stop(cancelOrders = true) {

        clearInterval(this.pingInterval);

        const message = JSON.stringify({
            'op': 'UNSUBSCRIPTION',
            'params': [
                'spot@private.deals.v3.api',
                'spot@private.orders.v3.api'
            ]
        });

        this.privateWSFeed.send(message);

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

        const orders = await this.getRequest('/openOrders', {
            symbol: this.exchangeSymbol
        });

        logger.log(`RPC Response: OpenOrdersResponse -> ${JSON.stringify(orders)}`)

        if (orders !== undefined) {

            return orders.map((o) => {
                return <OrderStatusUpdate>{
                    event: 'OrderStatusUpdate',
                    connectorType: 'Bitget',
                    symbol:  this.sklSymbol,
                    orderId: o.orderId,
                    sklOrderId: o.clientOrderId,
                    state: BitgetOpenOrdersStateMap[o.status],
                    side: BitgetStringSideMap[o.side],
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
        const result = await this.getRequest('/account', {});

        const baseAsset = self.group.name
        const quoteAsset = self.config.quoteAsset
        console.log(baseAsset);

        const usdt = result.balances.find(d => d.asset === quoteAsset) || { free: 0, locked: 0 };

        const base = result.balances.find(d => d.asset === baseAsset) || { free: 0, locked: 0 };

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

    public async placeOrders(request: BatchOrdersRequest): Promise<any> {
        const self = this
        const orders = request.orders.map(o => {
            const side = BitgetInvertedSideMap[o.side]
            const type = BitgetOrderTypeMap[o.type]
            return {
                symbol: self.exchangeSymbol,
                quantity: o.size.toFixed(8),
                price: o.price.toFixed(8),
                side,
                type,
            };
        })

        const batches = this.chunkArray(orders, 20);

        const pArray = batches.map(batch => {

            return this.postRequest('/batchOrders', {
                batchOrders: JSON.stringify(batch)
            });
        })

        const [completedBatches] = await Promise.all(pArray)
        logger.log(`Place order result: ${JSON.stringify(completedBatches)}`)
        if (completedBatches.find(b => b.code !== undefined)) {
            return Promise.reject(`At least one order in batch failed: ${JSON.stringify(completedBatches)}`)
        } else {
            return completedBatches
        }
    }

    public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
        const self = this
        return await self.deleteRequest('/openOrders', {
            symbol: self.exchangeSymbol
        });
    }

    private getEventType(message: any): SklEvent | null {

        if('code' in message && 'msg' in message) {
            logger.log(`Subscription response: ${message.code} - ${message.msg}`)
            return null
        }else if ('c' in message) {
            if (message.c.startsWith('spot@private.orders.v3.api')) {
                return 'OrderStatusUpdate'
            }
        }else{
            return null
        }
    }

    private createSklEvent(event: SklEvent, message: any, group: ConnectorGroup): Serializable[] {

        if (event === 'OrderStatusUpdate') {

            return [this.createOrderStatusUpdate(event, message, group)]

        } else {

            return [];

        }
    }

    private createOrderStatusUpdate(action: SklEvent, order: BitgetOrderProgress, group: ConnectorGroup): OrderStatusUpdate {

        const state: OrderState = BitgetWSOrderUpdateStateMap[order.d.s]

        const side: Side = BitgetSideMap[order.d.S]

        return {
            symbol: this.sklSymbol,
            connectorType: 'Bitget',
            event: action,
            state,
            orderId: order.d.i,
            sklOrderId: order.d.c,
            side,
            price: parseFloat(order.d.p),
            size: order.d.v,
            notional: parseFloat(order.d.p) * parseFloat(order.d.v),
            filled_price: parseFloat(order.d.ap),
            filled_size: parseFloat(order.d.a),
            timestamp: parseInt(order.t)
        }
    }

    private async safeGetListenKey() {

        const keys = await this.getRequest('/userDataStream', {});

        console.log('Roating Keys, found', keys);

        if (keys && keys.listenKey !== undefined) {

            for (const key of keys.listenKey) {

                await this.deleteRequest('/userDataStream', { listenKey: key });

            }

        }

        return await this.postRequest('/userDataStream', {});

    }

    private async deleteRequest(route, params): Promise<any> {

        const now = Date.now()

        let body = '';

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap = [];

            Object.keys(params).forEach(k => {

                pMap.push(`${k}=${encodeURIComponent(params[k])}`);

            });

            body = pMap.join('&');

        }

        const signature = CryptoJS
            .HmacSHA256(body, this.credential.secret);

        params.signature = signature;

        const header = {
            'Content-Type': 'application/json',
            'X-Bitget-APIKEY': this.credential.key,
        }

        try {

            const result = await this.axios.delete(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                headers: header,
                data: params
            });

            return result.data;

        } catch (error) {

            console.log(error);

        }

    }

    private async getRequest(route, params): Promise<any> {

        const now = Date.now()

        let body = '';

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap = [];

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
            'X-Bitget-APIKEY': this.credential.key,
        }

        try {

            const result = await this.axios.get(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                headers: header
            });

            return result.data;

        } catch (error) {

            console.log(error);

        }

    }

    private async postRequest(route, params): Promise<any> {

        const now = new Date().getTime();

        let body = undefined;

        params = { ...params, timestamp: now, recvWindow: 5000 * 2 };

        if (params) {

            const pMap = [];

            Object.keys(params).forEach(k => {

                pMap.push(`${k}=${encodeURIComponent(params[k])}`);

            });

            body = pMap.join('&');

        }

        const signature = CryptoJS
            .HmacSHA256(body, this.credential.secret)
        params.signature = signature;

        const header = {
            'Content-Type': 'application/json',
            'X-Bitget-APIKEY': this.credential.key,
        }

        try {

            const result = await this.axios.post(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {}, {
                headers: header
            });

            return result.data;

        } catch (error) {
            logger.log(`POST Error: ${error.toString()}`);
        }

    }

    private chunkArray(array, chunkSize): any {

        const chunks = [];

        for (let i = 0; i < array.length; i += chunkSize) {

            chunks.push(array.slice(i, i + chunkSize));

        }

        return chunks;

    }
}