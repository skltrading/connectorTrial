import axios from 'axios';
import { WebSocket } from 'ws';
import CryptoJS from 'crypto-js';
import {
    PrivateExchangeConnector,
    ConnectorConfiguration,
    ConnectorGroup,
    Credential,
    BalanceRequest,
    BalanceResponse,
    OrderStatusUpdate,
    CancelOrdersRequest,
    OpenOrdersRequest,
    BatchOrdersRequest,
    OrderState,
    Side,
    Order,
} from '../../types';
import { Logger } from '../../utils/logging';
import { createHmac } from 'crypto';
import { Serializable } from '../../types';

const logger = Logger.getInstance('coindcx-private-connector');

export class CoinDCXPrivateConnector implements PrivateExchangeConnector {
    public websocket: WebSocket | null = null;
    public publicWebsocketAddress = 'wss://stream.coindcx.com/ws';
    public restUrl = 'https://api.coindcx.com';
    private coinDCXSymbol: string;

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        this.coinDCXSymbol = `${this.group.name}${this.config.quoteAsset}`;
    }

    public async connect(onMessage: (m: Serializable[]) => void): Promise<void> {
        this.websocket = new WebSocket(this.publicWebsocketAddress);

        this.websocket.on('open', () => {
            logger.info('WebSocket connected');
            this.authenticate();
            this.subscribeToPrivateChannels();
        });

        this.websocket.on('message', (data: string) => {
            this.handleMessage(data, onMessage);
        });

        this.websocket.on('error', (error: Error) => {
            logger.error(`WebSocket error: ${error.message}`, error);
        });

        this.websocket.on('close', () => {
            logger.warn('WebSocket closed. Reconnecting...');
            setTimeout(() => this.connect(onMessage), 1000);
        });
    }

    private authenticate(): void {
        const timestamp = Date.now();
        const signature = this.createSignature(timestamp);
        const authMessage = {
            method: 'auth',
            api_key: this.credential.key,
            timestamp: timestamp,
            signature: signature,
        };
        this.websocket?.send(JSON.stringify(authMessage));
        logger.info('Authenticated with CoinDCX private WebSocket');
    }

    private createSignature(timestamp: number): string {
        const payload = `${this.credential.key}${timestamp}`;
        return CryptoJS.HmacSHA256(payload, this.credential.secret).toString();
    }

    private subscribeToPrivateChannels(): void {
        const channels = ['balance-update', 'order-update'];
        channels.forEach(channel => {
            const message = { method: 'SUBSCRIBE', params: [`coindcx@${channel}`] };
            this.websocket?.send(JSON.stringify(message));
            logger.info(`Subscribed to private channel: ${channel}`);
        });
    }

    private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
        const message = JSON.parse(data);
        // Log the entire message received from the WebSocket
        console.log("WebSocket Message:", JSON.stringify(message, null, 2));
        logger.debug(`Private message received: ${data}`);
    }
    

    // public async placeOrders(request: BatchOrdersRequest): Promise<void> {
    //     const endpoint = '/exchange/v1/orders/create';
    //     const timeStamp = Math.floor(Date.now());
    
    //     // Assuming only one order in the batch for simplicity
    //     const order = request.orders[0];
    //     const body = {
    //         side: order.side.toLowerCase(), // Convert to lowercase (buy/sell)
    //         order_type: order.type, // 'limit_order' or 'market_order'
    //         market: this.coinDCXSymbol, // The market symbol, e.g., 'BTCUSDT'
    //         price_per_unit: order.price.toString(), // Price for limit order
    //         total_quantity: order.size, // Quantity
    //         timestamp: timeStamp,
    //         client_order_id: `order_${timeStamp}` // An example client order ID
    //     };
    
    //     // Generate the signature based on the request body
    //     const payload = Buffer.from(JSON.stringify(body)).toString();
    //     const signature = createHmac('sha256', this.credential.secret)
    //         .update(payload)
    //         .digest('hex');
    
    //     try {
    //         const response = await axios.post(this.restUrl + endpoint, body, {
    //             headers: {
    //                 'X-AUTH-APIKEY': this.credential.key,
    //                 'X-AUTH-SIGNATURE': signature,
    //                 'Content-Type': 'application/json'
    //             },
    //         });
    //         logger.info('Order placed successfully');
    //         logger.debug(`Response: ${JSON.stringify(response.data)}`);
    //     } catch (error) {
    //         logger.error('Failed to place order', error);
    //         logger.debug(`Error Response: ${JSON.stringify(error)}`);
    //     }
    // }

    public async placeOrders(request: BatchOrdersRequest): Promise<void> {
        const endpoint = '/exchange/v1/orders/create';
        const timeStamp = Math.floor(Date.now());
    
        const order = request.orders[0];
        const body = {
            side: order.side.toLowerCase(), 
            order_type: "limit_order", 
            market: "BTCUSDT", 
            price_per_unit: "20000", 
            total_quantity: 0.1, 
            timestamp: timeStamp,
            client_order_id: `order_${timeStamp}` 
        };
    
        const payload = Buffer.from(JSON.stringify(body)).toString();
        const signature = createHmac('sha256', this.credential.secret).update(payload).digest('hex');
    
        try {
            const response = await axios.post(this.restUrl + endpoint, body, {
                headers: {
                    'X-AUTH-APIKEY': this.credential.key,
                    'X-AUTH-SIGNATURE': signature,
                    'Content-Type': 'application/json'
                },
            });
            logger.info('Order placed successfully');
            logger.debug(`Response: ${JSON.stringify(response.data)}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error('Failed to place order', error.message);
                logger.debug(`Error Response: ${JSON.stringify(error.response?.data || error.message)}`);
            } else {
                logger.error('Unexpected error occurred', error);
            }
        }
        
    }
    
    
    

    public async deleteAllOrders(request: CancelOrdersRequest): Promise<void> {
        const endpoint = '/exchange/v1/orders/cancel_all';
        const timestamp = Math.floor(Date.now());
        
        const body = {
            side: request.side?.toLowerCase(), // Use side from request if provided
            market: request.symbol, // Specify the market pair
            timestamp: timestamp
        };
    
        const payload = Buffer.from(JSON.stringify(body)).toString();
        const signature = createHmac('sha256', this.credential.secret).update(payload).digest('hex');
    
        try {
            const response = await axios.post(this.restUrl + endpoint, body, {
                headers: {
                    'X-AUTH-APIKEY': this.credential.key,
                    'X-AUTH-SIGNATURE': signature,
                    'Content-Type': 'application/json',
                },
            });
            logger.info('Orders cancelled successfully');
            logger.debug(`Response: ${JSON.stringify(response.data)}`); // Log the actual response
        } catch (error) {
            logger.error('Failed to cancel orders', error);
            logger.debug(`Error Response: ${JSON.stringify( error)}`); // Log error details
            throw error;
        }
    }
    

    public async getBalance(request: BalanceRequest): Promise<BalanceResponse> {
        const endpoint = '/exchange/v1/users/balances';
        const timestamp = Math.floor(Date.now());
        const body = {
            timestamp: timestamp,
        };
        const payload = Buffer.from(JSON.stringify(body)).toString();
        const signature = createHmac('sha256', this.credential.secret).update(payload).digest('hex');
    
        try {
            const response = await axios.post(this.restUrl + endpoint, body, {
                headers: {
                    'X-AUTH-APIKEY': this.credential.key,
                    'X-AUTH-SIGNATURE': signature,
                    'Content-Type': 'application/json',
                },
            });
            logger.info('Balance fetched successfully');
            logger.debug(`Response: ${JSON.stringify(response.data)}`);
            return { 
                event: 'BalanceResponse',
                timestamp: timestamp,
                symbol: '',
                connectorType: 'CoinDCX',
                balances: response.data.balances || [] 
            }; // Return in correct format
        } catch (error) {
            logger.error('Failed to fetch balance', error);
            logger.debug(`Error Response: ${JSON.stringify(error)}`);
            return Promise.reject(error); // Explicitly return a rejected promise
        }
    }
    
    
    

    async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
        const endpoint = '/exchange/v1/orders/active_orders';
        const body = {
            market: request.symbol,
            timestamp: Date.now(),
        };
    
        const jsonBody = JSON.stringify(body, Object.keys(body).sort());
    
        try {
            const signature = this.createSignature2(jsonBody);
            const response = await axios.post(this.restUrl + endpoint, jsonBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-AUTH-APIKEY': this.credential.key,
                    'X-AUTH-SIGNATURE': signature,
                },
            });
    
            logger.info('Active orders fetched successfully');
    
            return response.data.orders.map((order: any) => ({
                event: 'OrderStatusUpdate',
                connectorType: 'CoinDCX',
                orderId: order.id,
                sklOrderId: order.client_order_id,
                symbol: order.market,
                side: order.side ? order.side.charAt(0).toUpperCase() + order.side.slice(1) : 'Unknown',
                price: parseFloat(order.price_per_unit),
                size: parseFloat(order.total_quantity),
                notional: parseFloat(order.price_per_unit) * parseFloat(order.total_quantity),
                state: order.status === 'open' ? 'Placed' : order.status,
                filled_price: parseFloat(order.avg_price),
                filled_size: parseFloat(order.total_quantity) - parseFloat(order.remaining_quantity),
                timestamp: new Date(order.created_at).getTime(),
                order_type: order.order_type,
                fee_amount: parseFloat(order.fee_amount),
                fee: parseFloat(order.fee),
                total_quantity: parseFloat(order.total_quantity),
                remaining_quantity: parseFloat(order.remaining_quantity),
                avg_price: parseFloat(order.avg_price),
                created_at: order.created_at,
                updated_at: order.updated_at,
            }));
        } catch (error) {
            logger.error('Failed to fetch active orders', error);
            throw error;
        }
    }
    

    public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
        const balance = await this.getBalance(request);
        // Here you can implement logic to calculate balance percentage.
        return balance; // Return the balance response for now.
    }

    private createSignature2(body: string): string {
        const secretBytes = Buffer.from(this.credential.secret, 'utf-8');
        return createHmac('sha256', secretBytes).update(body).digest('hex');
    }

    public async stop(): Promise<void> {
        this.websocket?.close();
        logger.info('Stopped CoinDCX private connector');
    }

    private mapOrderState(status: string): OrderState {
        const stateMap: { [key: string]: OrderState } = {
            'new': 'Placed',
            'filled': 'Filled',
            'canceled': 'Cancelled',
            'partially_filled': 'PartiallyFilled',
        };
        return stateMap[status.toLowerCase()] || 'Unknown';
    }

    private mapOrderSide(side: string): Side {
        const sideMap: { [key: string]: Side } = {
            'buy': 'Buy',
            'sell': 'Sell',
        };
        return sideMap[side.toLowerCase()] || 'Unknown';
    }
}
