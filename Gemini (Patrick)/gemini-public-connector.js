import WebSocket from 'ws';  // Correct WebSocket import for ES module

class GeminiPublicConnector {
    constructor() {
        this.websocket = null;
        this.websocketUrl = 'wss://api.gemini.com/v1/marketdata/btcusd';  // Gemini WebSocket URL for BTC/USD pair
    }

    // Connect to the WebSocket
    connect(onMessage) {
        this.websocket = new WebSocket(this.websocketUrl);

        this.websocket.on('open', () => {
            console.log('WebSocket connection opened');
        });

        this.websocket.on('message', (data) => {
            onMessage(data);
        });

        this.websocket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.websocket.on('close', () => {
            console.log('WebSocket connection closed');
        });
    }

    // Stop the WebSocket connection
    stop() {
        if (this.websocket) {
            this.websocket.close();
            console.log('WebSocket connection closed by client');
        }
    }
}

export default GeminiPublicConnector;
