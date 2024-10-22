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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitgetSpotPrivateConnector = void 0;
const logging_1 = require("../../util/logging");
const crypto_js_1 = __importDefault(require("crypto-js"));
const axios_1 = __importDefault(require("axios"));
const ws_1 = require("ws");
const bitget_spot_1 = require("./bitget-spot");
const config_1 = require("../../util/config");
const BitgetWSOrderUpdateStateMap = {
    '1': 'Placed',
    '2': 'Filled',
    '3': 'PartiallyFilled',
    '4': 'Cancelled',
    '5': 'CancelledPartiallyFilled',
};
const BitgetOpenOrdersStateMap = {
    'NEW': 'Placed',
    'PARTIALLY_FILLED': 'PartiallyFilled',
};
const BitgetOrderTypeMap = {
    'Limit': 'LIMIT',
    'Market': 'MARKET',
    'LimitMaker': 'LIMIT_MAKER',
    'ImmediateOrCancel': 'IMMEDIATE_OR_CANCEL'
};
const logger = logging_1.Logger.getInstance('Bitget-spot-private-connector');
class BitgetSpotPrivateConnector {
    constructor(group, config, credential) {
        this.group = group;
        this.config = config;
        this.credential = credential;
        this.privateWebsocketAddress = 'wss://ws.bitget.com/v2/ws/private';
        this.privateRestEndpoint = 'https://api.Bitget.com/api/v3';
        const self = this;
        self.exchangeSymbol = (0, bitget_spot_1.getBitgetSymbol)(self.group, self.config);
        self.sklSymbol = (0, config_1.getSklSymbol)(self.group, self.config);
        self.axios = axios_1.default;
    }
    connect(onMessage_1) {
        return __awaiter(this, arguments, void 0, function* (onMessage, socket = undefined) {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const key = yield this.safeGetListenKey();
                const url = this.privateWebsocketAddress + `?listenKey=${key.listenKey}`;
                this.privateWSFeed = socket || new ws_1.WebSocket(url);
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
                    }, 1000 * 10);
                    resolve(true);
                });
                this.privateWSFeed.onmessage = (message) => {
                    const data = JSON.parse(message.data);
                    const actionType = this.getEventType(data);
                    if (actionType) {
                        const serializableMessages = this.createSklEvent(actionType, data, this.group);
                        onMessage(serializableMessages);
                    }
                    else {
                        logger.log(`No handler for message: ${JSON.stringify(data)}`);
                    }
                };
                this.privateWSFeed.on('error', function error(err) {
                    logger.log(`WebSocket error: ${err.toString()}`);
                });
                this.privateWSFeed.on('close', (code, reason) => {
                    logger.log(`WebSocket closed: ${code} - ${reason}`);
                    setTimeout(() => {
                        clearInterval(this.pingInterval);
                        this.connect(onMessage);
                    }, 1000);
                });
                if (this.privateWSFeed.__init !== undefined) {
                    this.privateWSFeed.__init();
                }
            }));
        });
    }
    stop() {
        return __awaiter(this, arguments, void 0, function* (cancelOrders = true) {
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
                return yield this.deleteAllOrders({
                    connectorType: this.config.connectorType,
                    event,
                    symbol: this.exchangeSymbol,
                    timestamp: new Date().getTime(),
                });
            }
        });
    }
    getCurrentActiveOrders(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield this.getRequest('/openOrders', {
                symbol: this.exchangeSymbol
            });
            logger.log(`RPC Response: OpenOrdersResponse -> ${JSON.stringify(orders)}`);
            if (orders !== undefined) {
                return orders.map((o) => {
                    return {
                        event: 'OrderStatusUpdate',
                        connectorType: 'Bitget',
                        symbol: this.sklSymbol,
                        orderId: o.orderId,
                        sklOrderId: o.clientOrderId,
                        state: BitgetOpenOrdersStateMap[o.status],
                        side: bitget_spot_1.BitgetStringSideMap[o.side],
                        price: parseFloat(o.price),
                        size: parseFloat(o.origQty),
                        notional: parseFloat(o.price) * parseFloat(o.origQty),
                        filled_price: parseFloat(o.price),
                        filled_size: parseFloat(o.executedQty),
                        timestamp: o.time
                    };
                });
            }
            return [];
        });
    }
    getBalancePercentage(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const result = yield this.getRequest('/account', {});
            const baseAsset = self.group.name;
            const quoteAsset = self.config.quoteAsset;
            console.log(baseAsset);
            const usdt = result.balances.find(d => d.asset === quoteAsset) || { free: 0, locked: 0 };
            const base = result.balances.find(d => d.asset === baseAsset) || { free: 0, locked: 0 };
            const baseVal = parseFloat(base.free) + parseFloat(base.locked);
            const baseValue = parseFloat((baseVal * request.lastPrice));
            const usdtValue = parseFloat(usdt.free) + parseFloat(usdt.locked);
            const whole = parseFloat(baseValue) + usdtValue;
            const pairPercentage = (baseValue / whole) * 100;
            return {
                event: "BalanceRequest",
                symbol: this.sklSymbol,
                baseBalance: baseVal,
                quoteBalance: usdtValue,
                inventory: pairPercentage,
                timestamp: new Date().getTime()
            };
        });
    }
    placeOrders(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const orders = request.orders.map(o => {
                const side = bitget_spot_1.BitgetInvertedSideMap[o.side];
                const type = BitgetOrderTypeMap[o.type];
                return {
                    symbol: self.exchangeSymbol,
                    quantity: o.size.toFixed(8),
                    price: o.price.toFixed(8),
                    side,
                    type,
                };
            });
            const batches = this.chunkArray(orders, 20);
            const pArray = batches.map(batch => {
                return this.postRequest('/batchOrders', {
                    batchOrders: JSON.stringify(batch)
                });
            });
            const [completedBatches] = yield Promise.all(pArray);
            logger.log(`Place order result: ${JSON.stringify(completedBatches)}`);
            if (completedBatches.find(b => b.code !== undefined)) {
                return Promise.reject(`At least one order in batch failed: ${JSON.stringify(completedBatches)}`);
            }
            else {
                return completedBatches;
            }
        });
    }
    deleteAllOrders(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            return yield self.deleteRequest('/openOrders', {
                symbol: self.exchangeSymbol
            });
        });
    }
    getEventType(message) {
        if ('code' in message && 'msg' in message) {
            logger.log(`Subscription response: ${message.code} - ${message.msg}`);
            return null;
        }
        else if ('c' in message) {
            if (message.c.startsWith('spot@private.orders.v3.api')) {
                return 'OrderStatusUpdate';
            }
        }
        else {
            return null;
        }
    }
    createSklEvent(event, message, group) {
        if (event === 'OrderStatusUpdate') {
            return [this.createOrderStatusUpdate(event, message, group)];
        }
        else {
            return [];
        }
    }
    createOrderStatusUpdate(action, order, group) {
        const state = BitgetWSOrderUpdateStateMap[order.d.s];
        const side = bitget_spot_1.BitgetSideMap[order.d.S];
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
        };
    }
    safeGetListenKey() {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = yield this.getRequest('/userDataStream', {});
            console.log('Roating Keys, found', keys);
            if (keys && keys.listenKey !== undefined) {
                for (const key of keys.listenKey) {
                    yield this.deleteRequest('/userDataStream', { listenKey: key });
                }
            }
            return yield this.postRequest('/userDataStream', {});
        });
    }
    deleteRequest(route, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            let body = '';
            params = Object.assign(Object.assign({}, params), { timestamp: now, recvWindow: 5000 * 2 });
            if (params) {
                const pMap = [];
                Object.keys(params).forEach(k => {
                    pMap.push(`${k}=${encodeURIComponent(params[k])}`);
                });
                body = pMap.join('&');
            }
            const signature = crypto_js_1.default
                .HmacSHA256(body, this.credential.secret);
            params.signature = signature;
            const header = {
                'Content-Type': 'application/json',
                'X-Bitget-APIKEY': this.credential.key,
            };
            try {
                const result = yield this.axios.delete(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                    headers: header,
                    data: params
                });
                return result.data;
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    getRequest(route, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            let body = '';
            params = Object.assign(Object.assign({}, params), { timestamp: now, recvWindow: 5000 * 2 });
            if (params) {
                const pMap = [];
                Object.keys(params).forEach(k => {
                    pMap.push(`${k}=${params[k]}`);
                });
                body = pMap.join('&');
            }
            const signature = crypto_js_1.default
                .HmacSHA256(body, this.credential.secret);
            params.signature = signature;
            const header = {
                'Content-Type': 'application/json',
                'X-Bitget-APIKEY': this.credential.key,
            };
            try {
                const result = yield this.axios.get(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {
                    headers: header
                });
                return result.data;
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    postRequest(route, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date().getTime();
            let body = undefined;
            params = Object.assign(Object.assign({}, params), { timestamp: now, recvWindow: 5000 * 2 });
            if (params) {
                const pMap = [];
                Object.keys(params).forEach(k => {
                    pMap.push(`${k}=${encodeURIComponent(params[k])}`);
                });
                body = pMap.join('&');
            }
            const signature = crypto_js_1.default
                .HmacSHA256(body, this.credential.secret);
            params.signature = signature;
            const header = {
                'Content-Type': 'application/json',
                'X-Bitget-APIKEY': this.credential.key,
            };
            try {
                const result = yield this.axios.post(`${this.privateRestEndpoint}${route}?${body}&signature=${signature}`, {}, {
                    headers: header
                });
                return result.data;
            }
            catch (error) {
                logger.log(`POST Error: ${error.toString()}`);
            }
        });
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
exports.BitgetSpotPrivateConnector = BitgetSpotPrivateConnector;
