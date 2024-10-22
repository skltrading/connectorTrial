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
const Bitget_spot_public_connector_1 = require("./Bitget-spot-public-connector");
const Bitget_spot_private_connector_1 = require("./Bitget-spot-private-connector");
global.WebSocket = require('ws');
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../util/config");
jest.mock('axios');
describe('Bitget: Public connector', () => {
    let connector;
    const mockGroup = { name: 'mock-group', quoteAsset: 'usdt' };
    const mockConfig = { symbol: 'mock-symbol', quoteAsset: 'usdt' };
    beforeEach(() => {
        connector = new Bitget_spot_public_connector_1.BitgetSpotPublicConnector(mockGroup, mockConfig);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('Can handle TopOfBook command', () => __awaiter(void 0, void 0, void 0, function* () {
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        yield connector.connect((msg) => {
            const expected = {
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                connectorType: 'Bitget',
                event: 'TopOfBook',
                timestamp: 1661932660144,
                askPrice: 20290.89,
                askSize: 0.67,
                bidPrice: 20290.89,
                bidSize: 0.67
            };
            expect(msg[0]).toStrictEqual(expected);
        }, imp);
        const depthMessage = {
            data: JSON.stringify({
                "c": "spot@public.limit.depth.v3.api@BTCUSDT@5",
                "d": {
                    "asks": [{
                            "p": "20290.89",
                            "v": "0.670000"
                        }],
                    "bids": [{
                            "p": "20290.89",
                            "v": "0.670000"
                        }],
                    "e": "spot@public.limit.depth.v3.api",
                    "r": "3407459756"
                },
                "s": "BTCUSDT",
                "t": 1661932660144
            })
        };
        imp.onmessage(depthMessage);
    }));
    it('Can handle Ticker command', () => __awaiter(void 0, void 0, void 0, function* () {
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        yield connector.connect((msg) => {
            const expected = {
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                connectorType: 'Bitget',
                event: 'Ticker',
                lastPrice: 36474.74,
                timestamp: 1699502456051000
            };
            expect(msg[0]).toStrictEqual(expected);
        }, imp);
        const depthMessage = {
            data: JSON.stringify({
                "d": {
                    "s": "BTCUSDT",
                    "p": "36474.74",
                    "r": "0.0354",
                    "tr": "0.0354",
                    "h": "36549.72",
                    "l": "35101.68",
                    "v": "375173478.65",
                    "q": "10557.72895",
                    "lastRT": "-1",
                    "MT": "0",
                    "NV": "--",
                    "t": "1699502456050"
                },
                "c": "spot@public.miniTicker.v3.api@BTCUSDT@UTC+8",
                "t": 1699502456051,
                "s": "BTCUSDT"
            })
        };
        imp.onmessage(depthMessage);
    }));
    it('Can handle Trade (Sell) command', () => __awaiter(void 0, void 0, void 0, function* () {
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        yield connector.connect((msg) => {
            const expected = {
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                connectorType: 'Bitget',
                event: 'Trade',
                price: 20233.84,
                size: 0.001028,
                side: 'Sell',
                timestamp: 1661927587825000
            };
            expect(msg[0]).toStrictEqual(expected);
        }, imp);
        const depthMessage = {
            data: JSON.stringify({
                "c": "spot@public.deals.v3.api@BTCUSDT",
                "d": {
                    "deals": [{
                            "S": 2,
                            "p": "20233.84",
                            "t": 1661927587825,
                            "v": "0.001028"
                        }],
                    "e": "spot@public.deals.v3.api"
                },
                "t": 1661927587836
            })
        };
        imp.onmessage(depthMessage);
    }));
    it('Can handle Trade (Buy) command', () => __awaiter(void 0, void 0, void 0, function* () {
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        yield connector.connect((msg) => {
            const expected = {
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                connectorType: 'Bitget',
                event: 'Trade',
                price: 20233.84,
                size: 0.001028,
                side: 'Buy',
                timestamp: 1661927587825000
            };
            expect(msg[0]).toStrictEqual(expected);
        }, imp);
        const depthMessage = {
            data: JSON.stringify({
                "c": "spot@public.deals.v3.api@BTCUSDT",
                "d": {
                    "deals": [{
                            "S": 1,
                            "p": "20233.84",
                            "t": 1661927587825,
                            "v": "0.001028"
                        }],
                    "e": "spot@public.deals.v3.api"
                },
                "t": 1661927587836
            })
        };
        imp.onmessage(depthMessage);
    }));
});
describe('Bitget: Private connector', () => {
    let connector;
    const mockGroup = { name: 'mock-group', quoteAsset: 'usdt' };
    const mockConfig = { symbol: 'mock-symbol', quoteAsset: 'usdt' };
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('Can Connect with handshake command', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        const ax = axios_1.default;
        ax.get.mockResolvedValueOnce({
            data: {
                listenKey: ['test']
            }
        });
        ax.delete.mockResolvedValueOnce({
            data: 'ok'
        });
        ax.post.mockResolvedValueOnce({
            data: {
                listenKey: 'test'
            }
        });
        yield connector.connect((msg) => {
            expect(true).toStrictEqual(true);
        }, imp);
    }));
    it('Can handle OrderStatusUpdate command', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const handlerMap = {};
        const imp = {
            on: (command, handler) => {
                handlerMap[command] = handler;
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };
        const ax = axios_1.default;
        ax.get.mockResolvedValueOnce({
            data: {
                listenKey: ['test']
            }
        });
        ax.delete.mockResolvedValueOnce({
            data: 'ok'
        });
        ax.post.mockResolvedValueOnce({
            data: {
                listenKey: 'test'
            }
        });
        yield connector.connect((msg) => {
            const expected = {
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                connectorType: 'Bitget',
                event: 'OrderStatusUpdate',
                state: 'Placed',
                orderId: 'e03a5c7441e44ed899466a7140b71391',
                sklOrderId: 'test123',
                side: 'Buy',
                price: 0.8,
                size: 10,
                notional: 8,
                filled_price: 0,
                filled_size: 8,
                timestamp: 1661938138193
            };
            expect(msg[0]).toStrictEqual(expected);
        }, imp);
        const depthMessage = {
            data: JSON.stringify({
                "c": "spot@private.orders.v3.api",
                "d": {
                    "A": 8.0,
                    "O": 1661938138000,
                    "S": 1,
                    "V": 10,
                    "a": 8,
                    "c": "test123",
                    "i": "e03a5c7441e44ed899466a7140b71391",
                    "m": 0,
                    "o": 1,
                    "p": 0.8,
                    "s": 1,
                    "v": 10,
                    "ap": 0,
                    "cv": 0,
                    "ca": 0
                },
                "s": "MXUSDT",
                "t": 1661938138193
            })
        };
        imp.onmessage(depthMessage);
    }));
    it.skip('Can handle getCurrentActiveOrders action', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const ax = axios_1.default;
        ax.get.mockResolvedValueOnce({
            data: [
                {
                    "symbol": "LTCBTC",
                    "orderId": 1,
                    "orderListId": -1,
                    "clientOrderId": "myOrder1",
                    "price": "0.1",
                    "origQty": "1.0",
                    "executedQty": "0.0",
                    "cummulativeQuoteQty": "0.0",
                    "status": "NEW",
                    "timeInForce": "GTC",
                    "type": "LIMIT",
                    "side": "BUY",
                    "stopPrice": "0.0",
                    "icebergQty": "0.0",
                    "time": 1499827319559,
                    "updateTime": 1499827319559,
                    "isWorking": true,
                    "origQuoteOrderQty": "0.000000"
                }
            ]
        });
        const result = yield connector.getCurrentActiveOrders({});
        const expected = [
            {
                event: 'OrderStatusUpdate',
                connectorType: 'Bitget',
                symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                orderId: 1,
                sklOrderId: 'myOrder1',
                state: 'Placed',
                side: "Buy",
                price: 0.1,
                size: 0,
                notional: 0.1,
                filled_price: 0.1,
                filled_size: 0,
                timestamp: 1499827319559
            }
        ];
        expect(result).toStrictEqual(expected);
    }));
    it.skip('Can handle getBalancePercentage action', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const ax = axios_1.default;
        ax.get.mockResolvedValueOnce({
            data: {
                "makerCommission": 20,
                "takerCommission": 20,
                "buyerCommission": 0,
                "sellerCommission": 0,
                "canTrade": true,
                "canWithdraw": true,
                "canDeposit": true,
                "updateTime": null,
                "accountType": "SPOT",
                "balances": [{
                        "asset": "USDT",
                        "free": "500",
                        "locked": "33"
                    }, {
                        "asset": "mock-group",
                        "free": "1000",
                        "locked": "33"
                    }],
                "permissions": ["SPOT"]
            }
        });
        const result = yield connector.getBalancePercentage({
            lastPrice: 1
        });
        const expected = {
            event: 'BalanceRequest',
            symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
            baseBalance: 1033,
            quoteBalance: 533,
            inventory: 65.96424010217113,
            timestamp: 1701171036857
        };
        expect(result.event).toStrictEqual(expected.event);
        expect(result.symbol).toStrictEqual(expected.symbol);
        expect(result.baseBalance).toStrictEqual(expected.baseBalance);
        expect(result.quoteBalance).toStrictEqual(expected.quoteBalance);
        expect(result.inventory).toStrictEqual(expected.inventory);
    }));
    it.skip('Can handle placeOrders(buy) action', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const ax = axios_1.default;
        const request = {
            event: 'BatchOrdersRequest',
            timestamp: new Date().getTime(),
            orders: [
                {
                    connectorType: 'Bitget',
                    symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                    size: 10,
                    price: 10,
                    side: 'Buy',
                    type: 'Limit',
                }
            ]
        };
        yield connector.placeOrders(request);
        const expected = `[{"symbol":"mock-groupusdt","size":"10.00000000","price":"10.00000000","side":"BUY","type":"LIMIT"}]`;
        expect(ax.post).toHaveBeenLastCalledWith(expect.stringContaining(encodeURIComponent(expected)), {}, { "headers": { "Content-Type": "application/json", "X-Bitget-APIKEY": "9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5" } });
    }));
    it.skip('Can handle placeOrders(sell) action', () => __awaiter(void 0, void 0, void 0, function* () {
        connector = new Bitget_spot_private_connector_1.BitgetSpotPrivateConnector(mockGroup, mockConfig, {
            key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
            secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
        });
        const ax = axios_1.default;
        const request = {
            event: 'BatchOrdersRequest',
            timestamp: new Date().getTime(),
            orders: [
                {
                    connectorType: 'Bitget',
                    symbol: (0, config_1.getSklSymbol)(mockGroup, mockConfig),
                    size: 10,
                    price: 10,
                    side: 'Sell',
                    type: 'Limit',
                }
            ]
        };
        yield connector.placeOrders(request);
        const expected = `[{"symbol":"mock-groupusdt","size":"10.00000000","price":"10.00000000","side":"SELL","type":"LIMIT"}]`;
        expect(ax.post).toHaveBeenLastCalledWith(expect.stringContaining(encodeURIComponent(expected)), {}, { "headers": { "Content-Type": "application/json", "X-Bitget-APIKEY": "9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5" } });
    }));
});
