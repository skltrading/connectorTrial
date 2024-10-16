import {
    PublicExchangeConnector,
    ConnectorConfiguration,
    ConnectorGroup,
    Serializable,
} from 'skl-shared';

export class ExchangeNamePublicConnector implements PublicExchangeConnector {
    private exchangeSymbol: string;
    private sklSymbol: string;
    private websocket: WebSocket;
    private publicWebsocketUrl: string = 'wss://stream.binance.com:9443/ws';

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration
    ) {
        this.exchangeSymbol = this.getExchangeSymbol(group, config);
        this.sklSymbol = this.getSklSymbol(group, config);
    }

    private getExchangeSymbol(group: ConnectorGroup, config: ConnectorConfiguration): string {
        return 'mappedExchangeSymbol'; // Update with actual logic
    }

    private getSklSymbol(group: ConnectorGroup, config: ConnectorConfiguration): string {
        return 'mappedSklSymbol'; // Update with actual logic
    }

    public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
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

    private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
        const message = JSON.parse(data);
        console.log('Received message:', message);
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

