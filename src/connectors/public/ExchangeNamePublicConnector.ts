import WebSocket from 'ws';  // Correct WebSocket import

export class ExchangeNamePublicConnector {
    private exchangeSymbol: string;
    private sklSymbol: string;
    private websocket: WebSocket;
    private publicWebsocketUrl: string = 'wss://stream.binance.com:9443/ws';  // Binance public WebSocket URL

    constructor(private group: any, private config: any) {
        this.exchangeSymbol = this.getExchangeSymbol(group, config);
        this.sklSymbol = this.getSklSymbol(group, config);
    }

    private getExchangeSymbol(group: any, config: any): string {
        return 'mappedExchangeSymbol';  // Placeholder logic for exchange symbol
    }

    private getSklSymbol(group: any, config: any): string {
        return 'mappedSklSymbol';  // Placeholder logic for SKL symbol
    }

    public async connect(onMessage: (messages: any[]) => void): Promise<void> {
        this.websocket = new WebSocket(this.publicWebsocketUrl);

        this.websocket.on('open', () => {
            console.log('WebSocket connection opened');
            this.subscribeToChannels();
        });

        this.websocket.on('message', (data: string) => {
            this.handleMessage(data, onMessage);
        });

        this.websocket.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });

        this.websocket.on('close', () => {
            console.log('WebSocket connection closed');
        });
    }

    private subscribeToChannels(): void {
        const channels = [
            `trades.${this.exchangeSymbol}`,
            `orderbook.${this.exchangeSymbol}`,
            `ticker.${this.exchangeSymbol}`,
        ];

        const subscriptionMessage = {
            method: 'SUBSCRIBE',
            params: channels,
        };

        this.websocket.send(JSON.stringify(subscriptionMessage));
        console.log('Subscribed to channels:', channels);
    }

    private handleMessage(data: string, onMessage: (messages: any[]) => void): void {
        const message = JSON.parse(data);
        console.log('Received message:', message);
        onMessage([message]);  // Adjust this logic as needed
    }

    public async stop(): Promise<void> {
        const unsubscribeMessage = {
            method: 'UNSUBSCRIBE',
            params: [
                `trades.${this.exchangeSymbol}`,
                `orderbook.${this.exchangeSymbol}`,
                `ticker.${this.exchangeSymbol}`,
            ],
        };
        this.websocket.send(JSON.stringify(unsubscribeMessage));
        this.websocket.close();
    }
}
