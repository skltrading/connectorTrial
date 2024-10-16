// import {
//     PrivateExchangeConnector,
//     ConnectorConfiguration,
//     ConnectorGroup,
//     Credential,
//     Serializable,
// } from 'skl-shared';

import WebSocket from 'ws';

export class BitfinexPublicConnector {
    private symbol: string
    private websocket: WebSocket
    private publicWebsocketUrl: string

    constructor(
        // private group: ConnectorGroup,
        // private config: ConnectorConfiguration,
        // private credential?: Credential,
    ) {
        console.log('constructor')
        this.symbol = 'tBTCUSD'
        this.publicWebsocketUrl = 'wss://api-pub.bitfinex.com/ws/2'
        this.connect()
        
    }

    public connect(){
        console.log('connecting')
        this.websocket = new WebSocket(this.publicWebsocketUrl);

        this.websocket.onopen = (e) => {
            // this.websocket.send(msg)
            console.log('subscribing')
            this.subscribeToChannels();
        }

        this.websocket.onmessage = (e) => {
            console.log('receiving message')
            const msgObject = JSON.parse(e.data as string);
            this.handleMessage(e.data);
        };

        // this.websocket.on('error', (error: Error) => {
        //     // Handle errors
        // });

        // this.websocket.on('close', () => {
        //     // Reconnect logic
        //     setTimeout(() => {
        //         this.connect(onMessage);
        //     }, 1000); // Reconnect after 1 second
        // });
    }

    private subscribeToChannels(): void {
        console.log('sending subscribe.')
        let msg = JSON.stringify({
            event: 'subscribe',
            channel: 'trades',
            symbol: this.symbol
        })

        this.websocket.send(msg);
    }

    private handleMessage(data: string): void {
        const message = JSON.parse(data);
        console.log(message)


    }

    // private getEventType(message: any): SklEvent | null {
    //     if (message.type === 'trade') {
    //         return 'Trade';
    //     } else if (message.type === 'orderbook') {
    //         return 'TopOfBook';
    //     } else if (message.type === 'ticker') {
    //         return 'Ticker';
    //     } else if (message.error) {
    //         logger.error(`Error message received: ${message.error}`);
    //         return null;
    //     } else if (message.event === 'subscription') {
    //         logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
    //         return null;
    //     }
    //     return null;
    // }

    // private createSerializableEvents(eventType: SklEvent, message: any): Serializable[] {
    //     switch (eventType) {
    //         case 'Trade':
    //             return [this.createTrade(message)];
    //         case 'TopOfBook':
    //             return [this.createTopOfBook(message)];
    //         case 'Ticker':
    //             return [this.createTicker(message)];
    //         default:
    //             return [];
    //     }
    // }

    // private createTrade(message: any): Trade {
    //     return {
    //         symbol: this.sklSymbol,
    //         connectorType: 'ExchangeName',
    //         event: 'Trade',
    //         price: parseFloat(message.price),
    //         size: parseFloat(message.size),
    //         side: mapExchangeSide(message.side),
    //         timestamp: new Date(message.timestamp).getTime(),
    //     };
    // }

    // private signMessage(message: any): any {
    //     if (this.credential) {
    //         // Implement signing logic
    //         // For example, add authentication headers or parameters
    //     }
    //     return message;
    // }

    // public async stop(): Promise<void> {
    //     const unsubscribeMessage = {
    //         method: 'UNSUBSCRIBE',
    //         params: [
    //             `trades.${this.exchangeSymbol}`,
    //             `orderbook.${this.exchangeSymbol}`,
    //             `ticker.${this.exchangeSymbol}`,
    //         ],
    //     };
    //     this.websocket.send(JSON.stringify(unsubscribeMessage));
    //     this.websocket.close();
    // }
}
