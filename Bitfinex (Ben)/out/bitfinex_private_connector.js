"use strict";
// import {
//     PrivateExchangeConnector,
//     ConnectorConfiguration,
//     ConnectorGroup,
//     Credential,
//     Serializable,
// } from 'skl-shared';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitfinexPrivateConnector = void 0;
var ws_1 = __importDefault(require("ws"));
var crypto_1 = __importDefault(require("crypto"));
var BitfinexPrivateConnector = /** @class */ (function () {
    function BitfinexPrivateConnector(
    // private group: ConnectorGroup,
    // private config: ConnectorConfiguration,
    credential) {
        this.credential = credential;
        this.bitfinexSymbol = 'tBTCUSD';
        this.credential = credential;
        this.privateWebsocketUrl = 'wss://api.bitfinex.com/';
        this.connect();
        this.pingInterval = 10000;
    }
    BitfinexPrivateConnector.prototype.connect = function () {
        var _this = this;
        console.log('connecting');
        this.websocket = new ws_1.default(this.privateWebsocketUrl);
        this.websocket.onopen = function (e) {
            // this.websocket.send(msg)
            console.log('subscribing');
            _this.startPingInterval();
        };
        this.websocket.onmessage = function (e) {
            console.log('receiving message');
            var msgObject = JSON.parse(e.data);
            console.log(msgObject);
        };
        this.websocket.on('error', function (error) {
            // Handle errors
            console.log(error.message);
        });
        this.websocket.onclose = function (e) {
            // Reconnect logic
            _this.stopPingInterval();
            setTimeout(function () {
                _this.connect();
            }, 1000); // Reconnect after 1 second
        };
    };
    BitfinexPrivateConnector.prototype.authenticate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, apiSecret, nonce, authPayload, authSig, payload;
            return __generator(this, function (_a) {
                apiKey = this.credential.apiKey;
                apiSecret = this.credential.apiSecret;
                nonce = (Date.now() * 1000).toString();
                authPayload = 'AUTH' + nonce;
                authSig = crypto_1.default.createHmac('sha384', apiSecret).update(authPayload).digest('hex');
                payload = {
                    apiKey: apiKey,
                    authSig: authSig,
                    nonce: nonce,
                    authPayload: authPayload,
                    event: 'auth'
                };
                this.websocket.send(JSON.stringify(payload));
                return [2 /*return*/];
            });
        });
    };
    // private async getListenKey(): Promise<string> {
    //     const response = await this.postRequest('/userDataStream', {});
    //     return response.listenKey;
    // }
    // private subscribeToPrivateChannels(): void {
    //     const channels = [
    //         'spot@private.deals.v3.api',
    //         'spot@private.orders.v3.api',
    //     ];
    //     const subscriptionMessage = {
    //         method: 'SUBSCRIPTION',
    //         params: channels,
    //     };
    //     this.websocket.send(JSON.stringify(subscriptionMessage));
    // }
    // public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    //     const maxBatchSize = 20; // Example limit
    //     const orders = request.orders.map(order => ({
    //         // Map order fields...
    //     }));
    //     const batches = this.chunkArray(orders, maxBatchSize);
    //     const promises = batches.map(batch => {
    //         return this.postRequest('/batchOrders', { batchOrders: JSON.stringify(batch) });
    //     });
    //     const results = await Promise.all(promises);
    //     return results;
    // }
    // private chunkArray(array: any[], chunkSize: number): any[] {
    //     const results = [];
    //     for (let i = 0; i < array.length; i += chunkSize) {
    //         results.push(array.slice(i, i + chunkSize));
    //     }
    //     return results;
    // }
    // public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
    //     const endpoint = '/api/v3/openOrders';
    //     return await this.deleteRequest(endpoint, { symbol: this.exchangeSymbol });
    // }
    // public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
    //     const endpoint = '/api/v3/openOrders';
    //     const response = await this.getRequest(endpoint, { symbol: this.exchangeSymbol });
    //     return response.map(order => ({
    //         event: 'OrderStatusUpdate',
    //         connectorType: 'ExchangeName',
    //         symbol: this.sklSymbol,
    //         orderId: order.orderId,
    //         sklOrderId: order.clientOrderId,
    //         state: mapOrderState(order.status),
    //         side: mapExchangeSide(order.side),
    //         price: parseFloat(order.price),
    //         size: parseFloat(order.origQty),
    //         notional: parseFloat(order.price) * parseFloat(order.origQty),
    //         filled_price: parseFloat(order.price),
    //         filled_size: parseFloat(order.executedQty),
    //         timestamp: order.time,
    //     }));
    // }
    // public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
    //     const endpoint = '/api/v3/account';
    //     const response = await this.getRequest(endpoint, {});
    //     const baseAsset = this.group.name;
    //     const quoteAsset = this.config.quoteAsset;
    //     const base = response.balances.find(b => b.asset === baseAsset) || { free: '0', locked: '0' };
    //     const quote = response.balances.find(b => b.asset === quoteAsset) || { free: '0', locked: '0' };
    //     const baseBalance = parseFloat(base.free) + parseFloat(base.locked);
    //     const quoteBalance = parseFloat(quote.free) + parseFloat(quote.locked);
    //     const baseValue = baseBalance * request.lastPrice;
    //     const totalValue = baseValue + quoteBalance;
    //     const inventoryPercentage = (baseValue / totalValue) * 100;
    //     return {
    //         event: 'BalanceResponse',
    //         symbol: this.sklSymbol,
    //         baseBalance,
    //         quoteBalance,
    //         inventory: inventoryPercentage,
    //         timestamp: Date.now(),
    //     };
    // }
    // private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
    //     const message = JSON.parse(data);
    //     const eventType = this.getEventType(message);
    //     if (eventType === 'OrderStatusUpdate') {
    //         const orderStatusUpdate = this.createOrderStatusUpdate(message);
    //         onMessage([orderStatusUpdate]);
    //     } else {
    //         // Handle other events or log unrecognized messages
    //     }
    // }
    // private getEventType(message: any): SklEvent | null {
    //     if (message.error) {
    //         logger.error(`Error message received: ${message.error}`);
    //         return null;
    //     } else if (message.event === 'subscription') {
    //         logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
    //         return null;
    //     } else if (message.type === 'orderUpdate') {
    //         return 'OrderStatusUpdate';
    //     }
    //     // Additional event type checks...
    //     return null;
    // }
    BitfinexPrivateConnector.prototype.startPingInterval = function () {
        var _this = this;
        setInterval(function () {
            _this.websocket.send(JSON.stringify({ method: 'PING' }));
        }, 10000); // Ping every 10 seconds
    };
    BitfinexPrivateConnector.prototype.stopPingInterval = function () {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    };
    return BitfinexPrivateConnector;
}());
exports.BitfinexPrivateConnector = BitfinexPrivateConnector;
//# sourceMappingURL=bitfinex_private_connector.js.map