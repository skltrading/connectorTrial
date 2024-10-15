import { placeOrderData, OrderStatusUpdate, Ticker, TopOfBook, Trade, Credential } from './types';

import { BinanceSpotPublicConnector } from './binance-spot-public-connector';
import { BinanceSpotPrivateConnector } from './binance-spot-private-connector';

global.WebSocket = require('ws');
import axios from 'axios';
import { getSklSymbol } from './binance-spot';

//import { getSklSymbol } from '../../util/config';

jest.mock('axios');

describe("Binance public connector", () => {

    let connector: BinanceSpotPublicConnector;

    const mockGroup: any = { name: 'mock-group', quoteAsset: 'usdt' };

    const mockConfig: any = { symbol: 'mock-symbol', quoteAsset: 'usdt' };

    //assuming getSklSymbol retrun this 'mock-symbolusdt'

    beforeEach(() => {
        connector = new BinanceSpotPublicConnector(mockGroup, mockConfig);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Can handle TopOfBook command', async () => {
        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        }

        await connector.connect((msg) => {
            const expected: TopOfBook = {
                symbol: getSklSymbol(mockGroup, mockConfig),
                connectorType: 'Binance',
                event: 'TopOfBook',
                timestamp: 1661932660144,
                askPrice: 66105.87000000,
                askSize: 0.00424000,
                bidPrice: 66096.00000000,
                bidSize: 0.01873000
            };

            expect(msg[0]).toStrictEqual(expected);
        }, mockWebSocket as any);

        const depthMessage = {
            data: JSON.stringify({
                "lastUpdateId": 11189994,
                "bids": [
                    [
                        "66096.00000000",
                        "0.01873000"
                    ],
                    [
                        "66095.99000000",
                        "0.00522000"
                    ],
                    [
                        "66095.71000000",
                        "0.00689000"
                    ],
                    [
                        "66095.70000000",
                        "0.00734000"
                    ],
                    [
                        "66095.59000000",
                        "0.00560000"
                    ]
                ],
                "asks": [
                    [
                        "66105.87000000",
                        "0.00424000"
                    ],
                    [
                        "66105.91000000",
                        "0.00432000"
                    ],
                    [
                        "66105.99000000",
                        "0.00628000"
                    ],
                    [
                        "66106.00000000",
                        "0.00628000"
                    ],
                    [
                        "66106.07000000",
                        "0.00515000"
                    ]
                ]
            })
        };

        mockWebSocket.onmessage(depthMessage);
    });

    it('Can handle Ticker command', async () => {

        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        }

        await connector.connect((msg) => {

            const expected: Ticker = {
                symbol: getSklSymbol(mockGroup, mockConfig),
                connectorType: 'Binance',
                event: 'Ticker',
                lastPrice: 0.0025,
                timestamp: 1672515782136000
            };

            expect(msg[0]).toStrictEqual(expected);

        }, mockWebSocket as any)

        const depthMessage = {
            data: JSON.stringify({
                e: "24hrTicker",  // Event type
                E: 1672515782136, // Event time in milliseconds
                s: "BNBBTC",      // Symbol
                c: "0.0025",      // Close price
                o: "0.0010",      // Open price
                h: "0.0025",      // High price
                l: "0.0010",      // Low price
                v: "10000",       // Total traded base asset volume
                q: "18",          // Total traded quote asset volume
            })
        };

        mockWebSocket.onmessage(depthMessage);

    });

    it('Can handle Trade (Sell) command', async () => {

        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };

        await connector.connect((msg) => {

            const expected: Trade = {
                symbol: getSklSymbol(mockGroup, mockConfig),
                connectorType: 'Binance',
                event: 'Trade',
                price: 0.001,
                size: 100,
                side: 'Sell',
                timestamp: 1672515782136
            };

            expect(msg[0]).toStrictEqual(expected);

        }, mockWebSocket as any)

        const depthMessage = {
            data: JSON.stringify({
                "e": "trade",       // Event type
                "E": 1672515782136, // Event time
                "s": "BNBBTC",      // Symbol
                "t": 12345,         // Trade ID
                "p": "0.001",       // Price
                "q": "100",         // Quantity
                "T": 1672515782136, // Trade time
                "m": true,          // Is the buyer the market maker?
                "M": true           // Ignore
            })
        };

        mockWebSocket.onmessage(depthMessage);

    });

    it('Can handle Trade (Buy) command', async () => {

        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };

        await connector.connect((msg) => {

            const expected: Trade = {
                symbol: getSklSymbol(mockGroup, mockConfig),
                connectorType: 'Binance',
                event: 'Trade',
                price: 0.001,
                size: 100,
                side: 'Buy',
                timestamp: 1672515782136
            };

            expect(msg[0]).toStrictEqual(expected);

        }, mockWebSocket as any)

        const depthMessage = {
            data: JSON.stringify({
                "e": "trade",       // Event type
                "E": 1672515782136, // Event time
                "s": "BNBBTC",      // Symbol
                "t": 12345,         // Trade ID
                "p": "0.001",       // Price
                "q": "100",         // Quantity
                "T": 1672515782136, // Trade time
                "m": false,          // Is the buyer the market maker?
                "M": true           // Ignore
            })
        };

        mockWebSocket.onmessage(depthMessage);

    });

});

describe('Mexc: Private connector', () => {

    let connector: BinanceSpotPrivateConnector;

    const mockGroup: any = { name: 'mock-group', quoteAsset: 'usdt' };

    const mockConfig: any = { symbol: 'mock-symbol', quoteAsset: 'usdt' };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Can connect with handshake command', async () => {
        connector = new BinanceSpotPrivateConnector(mockGroup, mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef'
            }
        )

        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };


        const ax: any = axios;

        ax.post.mockResolvedValueOnce({
            data: {
                listenKey: "test"
            }
        });

        ax.delete.mockResolvedValueOnce({});

        ax.put.mockResolvedValueOnce({});

        await connector.connect((msg) => {
            expect(true).toStrictEqual(true);

        }, mockWebSocket as any);

    });

    it('Can handle OrderStatusUpdate command', async () => {

        connector = new BinanceSpotPrivateConnector(
            mockGroup,
            mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
            },
        );

        const handlerMap: { [key: string]: (arg?: any) => void } = {};

        const mockWebSocket = {
            on: (command: string, handler: (arg?: any) => void) => {
                handlerMap[command] = handler
            },
            onmessage: jest.fn(),
            onerror: jest.fn(),
            send: jest.fn(),
            __init: () => {
                handlerMap['open']();
            }
        };

        const ax: any = axios;

        ax.post.mockResolvedValueOnce({
            data: {
                listenKey: "test"
            }
        });

        ax.delete.mockResolvedValueOnce({});

        ax.put.mockResolvedValueOnce({});

        await connector.connect((msg) => {

            const expected: OrderStatusUpdate = {
                symbol: getSklSymbol(mockGroup, mockConfig),
                connectorType: 'Binance',
                event: 'OrderStatusUpdate',
                state: 'Placed',
                orderId: '4293153',
                sklOrderId: 'executionReport',
                side: 'Buy',
                price: 0.10264410,
                size: 1.00000000,
                notional: 0.10264410,
                filled_price: 0.00000000,
                filled_size: 0.00000000,
                timestamp: 1499405658658
            };

            expect(msg[0]).toStrictEqual(expected);

        }, mockWebSocket as any);

        const depthMessage = {
            data: JSON.stringify({
                e: "executionReport",       // Event type
                s: "ETHBTC",                // Symbol
                S: "BUY",                   // Side
                i: 4293153,                 // Order ID
                c: "mUvoqJxFIILMdfAW5iGSOW",// Client order ID
                p: 0.10264410,              // Order price (converted from string to number)
                q: 1.00000000,              // Order quantity (converted from string to number)
                z: 0.00000000,              // Cumulative filled quantity (converted from string to number)
                Z: 0.00000000,              // Cumulative quote asset transacted quantity (converted from string to number)
                E: 1499405658658,           // Event time
                x: "NEW",                   // Current execution type
                X: "NEW",                   // Current order status
                o: "LIMIT"                  // Order type
            })
        };

        mockWebSocket.onmessage(depthMessage);

    });

    it('Can handle getCurrentActiveOrders action', async () => {

        connector = new BinanceSpotPrivateConnector(
            mockGroup,
            mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
            },
        );

        const ax: any = axios;

        ax.get.mockResolvedValueOnce({
            data: [
                {
                    "symbol": "LTCBTC",
                    "orderId": 1,
                    "orderListId": -1, // Unless it's part of an order list, value will be -1
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
                    "origQuoteOrderQty": "0.000000",
                    "workingTime": 1499827319559,
                    "selfTradePreventionMode": "NONE"
                }
            ]
        });

        const result = await connector.getCurrentActiveOrders({});

        const expected = [
            {
                event: 'OrderStatusUpdate',
                connectorType: 'Binance',
                symbol: 'LTCBTC',
                orderId: 1,
                sklOrderId: 'myOrder1',
                state: 'Placed',
                side: "Buy",
                price: 0.1,
                size: 1.0,
                notional: 0.1,
                filled_price: 0,
                filled_size: 0.000000,
                timestamp: 1499827319559
            }
        ];

        expect(result).toStrictEqual(expected);

    });

    it.skip('Can handle getBalancePercentage action', async () => {

        connector = new BinanceSpotPrivateConnector(
            mockGroup,
            mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
            },
        );

        const ax: any = axios;

        ax.get.mockResolvedValueOnce({
            data: {
                "makerCommission": 20,
                "takerCommission": 20,
                "buyerCommission": 0,
                "sellerCommission": 0,
                "commissionRates": {
                    "maker": "0.00150000",
                    "taker": "0.00150000",
                    "buyer": "0.00000000",
                    "seller": "0.00000000"
                },
                "canTrade": true,
                "canWithdraw": true,
                "canDeposit": true,
                "brokered": false,
                "requireSelfTradePrevention": false,
                "preventSor": false,
                "updateTime": 123456789,
                "accountType": "SPOT",
                "balances": [
                    {
                        "asset": "USDT",
                        "free": "500",
                        "locked": "33"
                    },
                    {
                        "asset": "mock-group",
                        "free": "1000",
                        "locked": "0.0330000000"
                    }
                ],
                "permissions": [
                    "SPOT"
                ],
                "uid": 354937868
            }
        });

        const result = await connector.getBalancePercentage({
            timestamp: 12345
        });

        const expected = {
            event: 'BalanceRequest',
            symbol: getSklSymbol(mockGroup, mockConfig),
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
    });

    it.skip('Can handle placeOrders(buy) action', async () => {

        connector = new BinanceSpotPrivateConnector(
            mockGroup,
            mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
            },
        );

        const ax: any = axios;

        const mockResponse = {
            data: [{
                symbol: "mock-groupusdt",
                orderId: 28,
                orderListId: -1, // Unless it's part of an order list, value will be -1
                clientOrderId: "6gCrw2kRUAF9CvJDGP16IP",
                transactTime: 1507725176595
            }]
        };

        ax.post.mockResolvedValue(mockResponse);

        const request: placeOrderData = {
            symbol: getSklSymbol(mockGroup, mockConfig),
            quantity: 10,
            price: 10,
            side: 'Buy',
            type: "Limit",
            newOrderRespType: "ACK",
            timestamp: Date.now()
        };

        await connector.placeOrder(request);

        const expected = `[{
                    "symbol": "mock-groupusdt",
                    "orderId": 28,
                    "orderListId": -1, // Unless it's part of an order list, value will be -1
                    "clientOrderId": "6gCrw2kRUAF9CvJDGP16IP",
                    "transactTime": 1507725176595
}]`

        expect(ax.post).toHaveBeenLastCalledWith(
            expect.stringContaining(encodeURIComponent(expected)),
            {},
            { "headers": { "Content-Type": "application/json", "X-MBX-APIKEY": "9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5" } }
        );

    });

    it.skip('Can handle placeOrders(Sell) action', async () => {

        connector = new BinanceSpotPrivateConnector(
            mockGroup,
            mockConfig,
            <Credential>{
                key: '9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5',
                secret: '448183b253bf1a5cebca0b7a09f75490325c5b0a876410f16092f9e716c6ebef',
            },
        );

        const ax: any = axios;

        const mockResponse = {
            data: [{
                symbol: "mock-groupusdt",
                orderId: 28,
                orderListId: -1, // Unless it's part of an order list, value will be -1
                clientOrderId: "6gCrw2kRUAF9CvJDGP16IP",
                transactTime: 1507725176595
            }]
        };

        ax.post.mockResolvedValue(mockResponse);

        const request: placeOrderData = {
            symbol: getSklSymbol(mockGroup, mockConfig),
            quantity: 10,
            price: 10,
            side: 'Sell',
            type: "Limit",
            newOrderRespType: "ACK",
            timestamp: Date.now()
        };

        await connector.placeOrder(request);

        const expected = `[{
                    "symbol": "mock-groupusdt",
                    "orderId": 28,
                    "orderListId": -1, // Unless it's part of an order list, value will be -1
                    "clientOrderId": "6gCrw2kRUAF9CvJDGP16IP",
                    "transactTime": 1507725176595
}]`

        expect(ax.post).toHaveBeenLastCalledWith(
            expect.stringContaining(encodeURIComponent(expected)),
            {},
            { "headers": { "Content-Type": "application/json", "X-MBX-APIKEY": "9e5a95533ff8e88a05bcde7fcf79d9fdf54ca0c5" } }
        );

    });


});