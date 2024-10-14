import {
    PublicExchangeConnector,
    ConnectorConfiguration,
    ConnectorGroup,
    Serializable,
} from 'skl-shared';

export class ExchangeNamePublicConnector implements PublicExchangeConnector {
    // Implementation
    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential?: Credential,
    ) {
        this.exchangeSymbol = getExchangeSymbol(this.group, this.config);
        this.sklSymbol = getSklSymbol(this.group, this.config);
    }


    public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
        this.websocket = new WebSocket(this.publicWebsocketUrl);
    
        this.websocket.on('open', () => {
            this.subscribeToChannels();
        });
    
        this.websocket.on('message', (data: string) => {
            this.handleMessage(data, onMessage);
        });
    
        this.websocket.on('error', (error: Error) => {
            // Handle errors
        });
    
        // this.websocket.on('close', () => {
        //     // Reconnect logic
        // });


        this.websocket.on('close', () => {
            setTimeout(() => {
                this.connect(onMessage);
            }, 1000); // Reconnect after 1 second
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
            // Include authentication if required
        };
    
        this.websocket.send(JSON.stringify(subscriptionMessage));
    }

    private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
        const message = JSON.parse(data);
        const eventType = this.getEventType(message);
    
        if (eventType) {
            const serializableMessages = this.createSerializableEvents(eventType, message);
            if (serializableMessages.length > 0) {
                onMessage(serializableMessages);
            }
        } else {
            // Log unrecognized messages
        }
    }

    private getEventType(message: any): SklEvent | null {
        if (message.type === 'trade') {
            return 'Trade';
        } else if (message.type === 'orderbook') {
            return 'TopOfBook';
        } else if (message.type === 'ticker') {
            return 'Ticker';
        } else if (message.error) {
            logger.error(`Error message received: ${message.error}`);
            return null;
        } else if (message.event === 'subscription') {
            logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
            return null;
        }
        return null;
    }

    private createSerializableEvents(eventType: SklEvent, message: any): Serializable[] {
        switch (eventType) {
            case 'Trade':
                return [this.createTrade(message)];
            case 'TopOfBook':
                return [this.createTopOfBook(message)];
            case 'Ticker':
                return [this.createTicker(message)];
            default:
                return [];
        }
    }
    
    private createTrade(message: any): Trade {
        return {
            symbol: this.sklSymbol,
            connectorType: 'ExchangeName',
            event: 'Trade',
            price: parseFloat(message.price),
            size: parseFloat(message.size),
            side: mapExchangeSide(message.side),
            timestamp: new Date(message.timestamp).getTime(),
        };
    }

    private signMessage(message: any): any {
        if (this.credential) {
            // Implement signing logic
            // For example, add authentication headers or parameters
        }
        return message;
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