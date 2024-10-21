import WebSocket from 'ws';

export default class GeminiPublicConnector {
    private websocket: WebSocket | null = null;
    private websocketUrl: string = 'wss://api.gemini.com/v1/marketdata/btcusd';

    connect(onMessage: (message: string) => void): void {
        this.websocket = new WebSocket(this.websocketUrl);

        this.websocket.on('open', () => {
            console.log('WebSocket connection opened');
        });

        this.websocket.on('message', (data: WebSocket.Data) => {
            onMessage(data.toString());
        });

        this.websocket.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });

        this.websocket.on('close', () => {
            console.log('WebSocket connection closed');
        });
    }

    stop(): void {
        if (this.websocket) {
            this.websocket.close();
            console.log('WebSocket connection closed by client');
        }
    }
}
