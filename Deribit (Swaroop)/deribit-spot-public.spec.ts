import * as Types from './types';
import { DeribitSpotPublicConnector } from './deribit-spot-public-connector';
import { WebSocket } from 'ws';

jest.mock('ws');

describe('DeribitSpotPublicConnector', () => {
    let connector: DeribitSpotPublicConnector;
    let mockWebSocket: WebSocket;
    const mockOnMessage = jest.fn();

    beforeEach(() => {
        mockWebSocket = new WebSocket('wss://www.deribit.com/ws/api/v2');
        (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWebSocket);
        connector = new DeribitSpotPublicConnector('BTC-PERPETUAL', { interval: "100ms" });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should create WebSocket connection and subscribe to channels on open', async () => {
        const subscribeToChannelsSpy = jest.spyOn<any, any>(connector, 'subscribeToChannels');

        await connector.connect(mockOnMessage);
        
        // Simulate WebSocket open event
        mockWebSocket.emit('open');
        
        setTimeout(() => {
            expect(subscribeToChannelsSpy).toHaveBeenCalled();
        }, 2000)

        expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    }, 3000);

    test('should handle WebSocket message correctly', async () => {
        const handleMessageSpy = jest.spyOn<any, any>(connector, 'handleMessage');

        await connector.connect(mockOnMessage);
        
        const mockMessage = Buffer.from(JSON.stringify({
            params: { channel: 'book.BTC-PERPETUAL.100ms' },
        }));
        mockWebSocket.emit('message', mockMessage);

        setTimeout(() => {
            expect(handleMessageSpy).toHaveBeenCalledWith(mockMessage.toString(), mockOnMessage);
        }, 2000)
    }, 5000);

    test('should handle WebSocket error and retry connection', async () => {
        const connectSpy = jest.spyOn<any, any>(connector, 'connect');

        await connector.connect(mockOnMessage);
        
        // Simulate WebSocket error
        mockWebSocket.emit('error', new Error('Connection failed'));


        setTimeout(() => {
            expect(connectSpy).toHaveBeenCalledTimes(2); // 1 + 1 retry
        }, 3000)
    }, 5000);

    test('should stop and unsubscribe from all channels', async () => {
        const unsubscribeToAllChannelsSpy = jest.spyOn(connector, 'unsubscribeToAllChannels');

        await connector.connect(mockOnMessage);
        await connector.stop();

        expect(unsubscribeToAllChannelsSpy).toHaveBeenCalled();
        expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should destroy the WebSocket connection', async () => {
        await connector.connect(mockOnMessage);
        await connector.destroy();

        expect(mockWebSocket.terminate).toHaveBeenCalled();
    });

    test('should send version request', async () => {
        await connector.connect(mockOnMessage);
        await connector.getVersion();

        expect(mockWebSocket.send).toHaveBeenCalledWith(
            JSON.stringify({ id: 'Version', method: '/public/test' })
        );
    });

    test('should correctly subscribe to channels', async () => {
        const sendSpy = jest.spyOn(mockWebSocket, 'send');
        
        await connector.connect(mockOnMessage);

        // Simulate WebSocket open event to trigger subscription
        mockWebSocket.emit('open');

        setTimeout(() => {
            expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({
                method: 'public/subscribe',
                params: {
                    channels: ['trades.BTC-PERPETUAL.100ms', 'ticker.BTC-PERPETUAL.100ms', 'book.BTC-PERPETUAL.100ms'],
                },
            }));
        }, 2000)
    }, 5000);
});
