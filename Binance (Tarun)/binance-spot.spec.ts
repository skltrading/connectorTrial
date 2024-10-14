import { placeOrderData, OrderStatusUpdate, Ticker, TopOfBook, Trade } from './types';

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

    await connector.connect((msg)=> {
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

    let connector;

    const mockGroup: any = { name: 'mock-group', quoteAsset: 'usdt' };

    const mockConfig: any = { symbol: 'mock-symbol', quoteAsset: 'usdt' };

    afterEach(() => {
        jest.restoreAllMocks();
    });
    
});