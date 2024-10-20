// public conncetor

import { CoinDCXPublicConnector } from '../connectors/public/coindcx-public-connector';
import { ConnectorConfiguration, ConnectorGroup, Serializable } from "../types";

const liveGroup: ConnectorGroup = {
    name: 'B-BTC_USDT',
};

const liveConfig: ConnectorConfiguration = {
    quoteAsset: 'USDT',
    baseURL: 'https://api.coindcx.com',
    connectorType: 'coindcx',
};

let connector: CoinDCXPublicConnector;

beforeAll(() => {
    connector = new CoinDCXPublicConnector(liveGroup, liveConfig);
});

jest.setTimeout(5000); // Increase timeout to 30 seconds

test('should connect to real WebSocket and handle messages', async () => {
    await connector.connect((messages: Serializable[]) => {
        console.log("Received messages:", messages);
        expect(messages.length).toBeGreaterThan(0);
    });
});



test('should handle price-change event', async () => {
    await connector.connect((messages: Serializable[]) => {
        console.log("Received messages:", messages);
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].event).toBe("PriceChange");
    });

    // Wait for a moment to allow event processing
    await new Promise(resolve => setTimeout(resolve, 1000));
});



test('should handle depth-update event', async () => {
       await connector.connect((messages: Serializable[]) => {
            console.log("Received messages:", messages);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0].event).toBe("DepthUpdate");
        })

    await new Promise(resolve => setTimeout(resolve, 1000));
});

test('should handle trade-update event', async () => {
    await connector.connect((messages: Serializable[]) => {
            console.log("Received messages:", messages);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0].event).toBe("TradeUpdate");
        })

    await new Promise(resolve => setTimeout(resolve, 1000));
});

test('should handle candlestick event', async () => {
        connector.connect((messages: Serializable[]) => {
            console.log("Received messages:", messages);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0].event).toBe("Candlestick");

        })

    await new Promise(resolve => setTimeout(resolve, 1000));
});





test('should subscribe and unsubscribe to real WebSocket channels', async () => {
    connector.subscribeToAllChannels();
    // Wait for a moment to receive messages
    await new Promise(resolve => setTimeout(resolve, 3000));
    connector.unsubscribeFromAllChannels();
});

test('should close the real WebSocket connection properly', async () => {
    await connector.stop();
});

afterAll(async () => {
    await connector.stop();
});













// Private conncetor testing
// import { CoinDCXPrivateConnector } from '../connectors/private/coindcx-private-connector';
// import { ConnectorConfiguration, ConnectorGroup, Credential, BalanceRequest, CancelOrdersRequest, OpenOrdersRequest } from "../types";

// const mockGroup: ConnectorGroup = { name: 'BTC' };
// const mockConfig: ConnectorConfiguration = { baseURL: 'https://api.coindcx.com', connectorType: 'private', quoteAsset: 'USDT' };
// const mockCredential: Credential = { key: '9c45e5f6fd254afc92681b819e6dc55accf357b3a35aaad7', secret: '00b9d566e08e1fde7eff19aaa65d24b0f3c5678a05322a3a71e09d52d605d4c1' };
// let connector: CoinDCXPrivateConnector;

// beforeEach(() => {
//     connector = new CoinDCXPrivateConnector(mockGroup, mockConfig, mockCredential);
// });

// test('should place orders correctly', async () => {
//     const response = await connector.placeOrders({ orders: [{ price: 20000, size: 0.1, side: 'Buy', type: 'limit' }] });
//     console.log('Place Orders Response:', response);
// });

// test('should fetch active orders', async () => {
//     const orders = await connector.getCurrentActiveOrders({ symbol: 'BTCUSDT' });
//     console.log('Active Orders:', orders);
//     expect(orders.length).toBeGreaterThanOrEqual(0);
// });

// test('should fetch balance correctly', async () => {
//     const request: BalanceRequest = {
//         event: 'BalanceRequest',
//         timestamp: Date.now(), 
//         connectorType: 'CoinDCX'
//     };

//     try {
//         const balanceResponse = await connector.getBalance(request);
//         console.log('Balance Response:', balanceResponse);
        
//         if (balanceResponse.balances.length === 0) {
//             console.warn('No balances available.');
//         } else {
//             expect(parseFloat(balanceResponse.balances[0].available)).toBeGreaterThanOrEqual(0);
//         }
//     } catch (error) {
//         console.error('Failed to fetch balance:', error);
//         throw error;
//     }
// });


// test('should cancel all orders correctly', async () => {
//     const cancelRequest: CancelOrdersRequest = {
//         event: 'CancelOrders',
//         timestamp: Date.now(),
//         connectorType: 'CoinDCX',
//         symbol: 'BTCUSDT',
//         side: 'buy' // Add the required side property
//     };

//     const response = await connector.deleteAllOrders(cancelRequest);
//     console.log('Cancel Orders Response:', response);
// });



// afterAll(async () => {
//     await connector.stop();
// });
