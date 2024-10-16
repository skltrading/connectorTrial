// import {
//     PrivateExchangeConnector,
//     ConnectorConfiguration,
//     ConnectorGroup,
//     Credential,
//     Serializable,
// } from 'skl-shared';

import WebSocket from 'ws';
import crypto from 'crypto'

export interface Credential {
    apiKey: string,
    apiSecret: string
}

export class BitfinexPrivateConnector {
    private bitfinexSymbol: string
    private websocket: WebSocket
    private privateWebsocketUrl: string
    private pingInterval: number
    
    constructor(
        // private group: ConnectorGroup,
        // private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        this.bitfinexSymbol = 'tBTCUSD'
        this.credential = credential
        this.privateWebsocketUrl = 'wss://api.bitfinex.com/'
        this.connect()
        this.pingInterval = 10000
    }
    
    public connect(){
        console.log('connecting')
        this.websocket = new WebSocket(this.privateWebsocketUrl);

        this.websocket.onopen = (e) => {
            // this.websocket.send(msg)
            console.log('subscribing')
            this.startPingInterval();
        }

        this.websocket.onmessage = (e) => {
            console.log('receiving message')
            const msgObject = JSON.parse(e.data as string);
            console.log(msgObject)
        };

        this.websocket.on('error', (error: Error) => {
            // Handle errors
            console.log(error.message)
        });

        this.websocket.onclose = (e) => {
            // Reconnect logic
            this.stopPingInterval();
            setTimeout(() => {
                this.connect();
            }, 1000); // Reconnect after 1 second
        }
    }

    private async authenticate(): Promise<void> {
        const apiKey = this.credential.apiKey
        const apiSecret = this.credential.apiSecret

        const nonce = (Date.now() * 1000).toString()
        const authPayload = 'AUTH' + nonce 
        const authSig = crypto.createHmac('sha384', apiSecret).update(authPayload).digest('hex') 

        const payload = {
            apiKey,
            authSig,
            nonce, 
            authPayload,
            event: 'auth'
        }

        this.websocket.send(JSON.stringify(payload))
    }

    // private async getListenKey(): Promise<string> {
    //     const response = await this.postRequest('/userDataStream', {});
    //     return response.listenKey;
    // }

    // private subscribeToPrivateChannels(): void {
    //     const channels = [
    //         'spot@private.deals.v3.api',
    //         'spot@private.orders.v3.api',
    //     ];
    //     const subscriptionMessage = {
    //         method: 'SUBSCRIPTION',
    //         params: channels,
    //     };
    //     this.websocket.send(JSON.stringify(subscriptionMessage));
    // }

    // public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    //     const maxBatchSize = 20; // Example limit
    //     const orders = request.orders.map(order => ({
    //         // Map order fields...
    //     }));
    
    //     const batches = this.chunkArray(orders, maxBatchSize);
    
    //     const promises = batches.map(batch => {
    //         return this.postRequest('/batchOrders', { batchOrders: JSON.stringify(batch) });
    //     });
    
    //     const results = await Promise.all(promises);
    //     return results;
    // }
    
    // private chunkArray(array: any[], chunkSize: number): any[] {
    //     const results = [];
    //     for (let i = 0; i < array.length; i += chunkSize) {
    //         results.push(array.slice(i, i + chunkSize));
    //     }
    //     return results;
    // }

    // public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
    //     const endpoint = '/api/v3/openOrders';
    //     return await this.deleteRequest(endpoint, { symbol: this.exchangeSymbol });
    // }

    // public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
    //     const endpoint = '/api/v3/openOrders';
    //     const response = await this.getRequest(endpoint, { symbol: this.exchangeSymbol });
    
    //     return response.map(order => ({
    //         event: 'OrderStatusUpdate',
    //         connectorType: 'ExchangeName',
    //         symbol: this.sklSymbol,
    //         orderId: order.orderId,
    //         sklOrderId: order.clientOrderId,
    //         state: mapOrderState(order.status),
    //         side: mapExchangeSide(order.side),
    //         price: parseFloat(order.price),
    //         size: parseFloat(order.origQty),
    //         notional: parseFloat(order.price) * parseFloat(order.origQty),
    //         filled_price: parseFloat(order.price),
    //         filled_size: parseFloat(order.executedQty),
    //         timestamp: order.time,
    //     }));
    // }

    // public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
    //     const endpoint = '/api/v3/account';
    //     const response = await this.getRequest(endpoint, {});
    
    //     const baseAsset = this.group.name;
    //     const quoteAsset = this.config.quoteAsset;
    
    //     const base = response.balances.find(b => b.asset === baseAsset) || { free: '0', locked: '0' };
    //     const quote = response.balances.find(b => b.asset === quoteAsset) || { free: '0', locked: '0' };
    
    //     const baseBalance = parseFloat(base.free) + parseFloat(base.locked);
    //     const quoteBalance = parseFloat(quote.free) + parseFloat(quote.locked);
    
    //     const baseValue = baseBalance * request.lastPrice;
    //     const totalValue = baseValue + quoteBalance;
    //     const inventoryPercentage = (baseValue / totalValue) * 100;
    
    //     return {
    //         event: 'BalanceResponse',
    //         symbol: this.sklSymbol,
    //         baseBalance,
    //         quoteBalance,
    //         inventory: inventoryPercentage,
    //         timestamp: Date.now(),
    //     };
    // }

    // private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
    //     const message = JSON.parse(data);
    //     const eventType = this.getEventType(message);
    
    //     if (eventType === 'OrderStatusUpdate') {
    //         const orderStatusUpdate = this.createOrderStatusUpdate(message);
    //         onMessage([orderStatusUpdate]);
    //     } else {
    //         // Handle other events or log unrecognized messages
    //     }
    // }
    
    // private getEventType(message: any): SklEvent | null {
    //     if (message.error) {
    //         logger.error(`Error message received: ${message.error}`);
    //         return null;
    //     } else if (message.event === 'subscription') {
    //         logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
    //         return null;
    //     } else if (message.type === 'orderUpdate') {
    //         return 'OrderStatusUpdate';
    //     }
    //     // Additional event type checks...
    //     return null;
    // }

    private startPingInterval(): void {
        setInterval(() => {
            this.websocket.send(JSON.stringify({ method: 'PING' }));
        }, 10000); // Ping every 10 seconds
    }
    
    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
