import axios from 'axios';
import { WebSocket } from 'ws';
// import CryptoJS from 'crypto-js';
import {
    BalanceRequest,
    BalanceResponse,
    BatchOrdersRequest,
    CancelOrdersRequest,
    ConnectorConfiguration,
    ConnectorGroup,
    Credential,
    OpenOrdersRequest,
    OrderState,
    OrderStatusUpdate,
    PrivateExchangeConnector,
    SklEvent,
    Side,
    Serializable
} from '../../types';
import {
    getGateSymbol,
    GateTradeSide,
    GateSideMap,
} from './gate-spot';
import { Logger } from '../../util/logging';
import { getSklSymbol } from '../../util/config-private';
// import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as CryptoJS from 'crypto-js';


const logger = Logger.getInstance('gate-spot-private-connector')

interface GateEvent {
    channel: string;
    time: string;
    sequence_num: number;
    result: any;
}

interface GateOrderStatusEvent {
    orders: GateOrderStatus[];  // Array of order statuses in the event
    sequence: string;           // Sequence number of the update
    has_next: boolean;          // Indicates if there are more updates to be fetched
    cursor: string;             // Cursor for pagination

}

interface GateOrderStatus {
    id: string;               // Order ID
    user: number;             // User ID
    text: string;             // User-defined information (e.g., 'web' or custom order ID)
    create_time: string;      // Order creation time (in seconds)
    create_time_ms: string;   // Order creation time in milliseconds
    update_time: string;      // Last update time (in seconds)
    update_time_ms: string;   // Last update time in milliseconds
    event: 'put' | 'update' | 'finish';  // Order event type (put, update, finish)
    currency_pair: string;    // Currency pair (e.g., 'BTC_USDT')
    type: string;             // Order type (e.g., 'limit')
    account: string;          // Account type (e.g., 'spot', 'margin')
    side: 'buy' | 'sell';     // Order side ('buy' or 'sell')
    amount: string;           // Total trade amount
    price: string;            // Order price
    time_in_force: string;    // Time in force ('gtc', 'ioc', etc.)
    left: string;             // Remaining amount to fill
    filled_total: string;     // Total filled in quote currency
    avg_deal_price: string;   // Average transaction price
    fee: string;              // Fee deducted
    fee_currency: string;     // Fee currency unit
    point_fee: string;        // Points used to deduct fee (optional, may be missing)
    gt_fee: string;           // GT token fee used to deduct (optional, may be missing)
    rebated_fee: string;      // Rebated fee (optional, may be missing)
    rebated_fee_currency: string; // Rebated fee currency unit (optional, may be missing)
    stp_id: number;           // Self-trading prevention group ID (optional, may be 0)
    stp_act: string;          // Self-trading prevention action (optional, can be '-')
    finish_as: 'open' | 'filled' | 'cancelled';  // Final status ('open', 'filled', 'cancelled')
    amend_text: string;       // Custom data when order was amended (optional, can be '-')
}

interface GateOpenOrder {
    id: string;                 // Order ID
    text: string;               // User-defined information
    amend_text: string;         // Custom data when amending the order
    create_time: string;        // Creation time of the order (in seconds)
    update_time: string;        // Last modification time of the order (in seconds)
    create_time_ms: number;     // Creation time in milliseconds
    update_time_ms: number;     // Last modification time in milliseconds
    status: string;             // Order status (open, filled, cancelled, etc.)
    currency_pair: string;      // Currency pair (e.g., BTC_USDT)
    type: string;               // Order type (limit, market)
    account: string;            // Account type (spot, margin, etc.)
    side: string;               // Order side (buy or sell)
    amount: string;             // Total amount of the trade
    price: string;              // Price of the order (limit orders only)
    time_in_force: string;      // Time in force (gtc, ioc, fok, etc.)
    iceberg: string | null;     // Amount to display for iceberg orders (null or 0 for regular orders)
    auto_repay: boolean;        // Auto repayment for margin orders (true or false)
    left: string;               // Amount left to fill
    filled_amount: string;      // Amount already filled
    fill_price: string;         // Total filled in quote currency (deprecated, use filled_total)
    filled_total: string;       // Total filled in quote currency
    avg_deal_price: string;     // Average fill price
    fee: string;                // Fee deducted
    fee_currency: string;       // Currency unit of the fee
    point_fee: string;          // Points used to deduct fee
    gt_fee: string;             // GT token used to deduct fee
    gt_maker_fee: string;       // GT token used to deduct maker fee
    gt_taker_fee: string;       // GT token used to deduct taker fee
    gt_discount: boolean;       // Whether GT fee discount is applied
    rebated_fee: string;        // Rebated fee
    rebated_fee_currency: string; // Rebated fee currency unit
    stp_id: number;             // Self-trading prevention group ID
    stp_act: string;            // Self-trading prevention action (cn, co, cb, etc.)
    finish_as: string;          // Order completion status (open, filled, cancelled, etc.)
}

interface GateOpenOrderResponse {
    currency_pair: string;  // Currency pair (e.g., "ETH_BTC")
    total: number;          // Total number of open orders for this trading pair
    orders: GateOpenOrder[];    // Array of open orders
}





const websocketOrderUpdateStateMap: { [key: string]: OrderState } = {
    'OPEN': 'Placed',
    'FILLED': 'Filled',
    'CANCELLED': 'Cancelled',
    'EXPIRED': 'Cancelled',
    'FAILED': 'Cancelled',
}


const getEventType = (message: GateEvent): SklEvent | null => {

    if (message.channel === 'spot.orders') {
        return 'OrderStatusUpdate'
    }
    return null
}

export class GateSpotPrivateConnector
    implements PrivateExchangeConnector {
    public publicWebsocketAddress = 'wss://api.gateio.ws/ws/v4/'
    public restUrl = 'https://api.gateio.ws'
    private route = '/api/v4'
    private gateSymbol: string = "";
    private sklSymbol: string = "";
    public publicWebsocketFeed: any
    private pingInterval: any
    private tokenRefreshInterval = 1000 * 60 * 1.5;
    private apiKey = '';        // Your API key
    private apiSecret = '';

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        const self = this
        self.gateSymbol = getGateSymbol(self.group, self.config)
        self.sklSymbol = getSklSymbol(self.group, self.config)
    }

    public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
        const self = this;
        const publicFeed = new Promise((resolve) => {
            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);

            // Handle WebSocket 'open' event
            self.publicWebsocketFeed.on('open', () => {
                logger.info('Private WebSocket connection opened');
                self.subscribeToProducts('spot.ping');
                self.subscribeToProducts('spot.orders');

                resolve(true);
            });

            // Handle incoming WebSocket messages
            self.publicWebsocketFeed.on('message', (message: any) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    const gateEvent = parsedMessage;

                    if (gateEvent.channel === "spot.pong") {
                        logger.log(`Ping received: timestamp = ${gateEvent.time}`);
                    } else {
                        const actionType: SklEvent | null = getEventType(gateEvent);

                        if (actionType) {
                            const result = gateEvent; // Get the result data



                            let serializableMessages: Serializable[] = [];

                            // Check if result is an array or a single object and handle accordingly
                            if (Array.isArray(result)) {
                                serializableMessages = result.map((trade: any) => self.createSklEvent(actionType, trade, self.group)).flat();
                            } else {
                                // If the result is a single object
                                serializableMessages = [...self.createSklEvent(actionType, result, self.group)];
                            }

                            if (serializableMessages.length > 0) {
                                onMessage(serializableMessages);
                            } else {
                                logger.log(`No messages generated for event: ${JSON.stringify(gateEvent)}`);
                            }
                        } else {
                            logger.log(`No handler for message: ${JSON.stringify(gateEvent)}`);
                        }
                    }
                } catch (error: any) {
                    logger.error(`Error parsing WebSocket message: ${error.message}`, message);
                }
            });

            // Handle WebSocket 'error' event
            self.publicWebsocketFeed.on('error', (error: Error) => {
                logger.error('WebSocket error:', error);
            });

            // Handle WebSocket 'close' event
            self.publicWebsocketFeed.on('close', () => {
                logger.warn('WebSocket connection closed, attempting to reconnect private');
                setTimeout(() => {
                    self.connect(onMessage);
                }, 1000);
            });
        });

        await Promise.all([publicFeed]);
    }

    private logSerializableEvent(eventType: string, data: Serializable) {
        // Create a formatted log message with the event details
        const logMessage = `
    [EVENT]: ${eventType.toUpperCase()}
    [SYMBOL]: ${data.symbol}
    [CONNECTOR]: ${data.connectorType}
    [DETAILS]: ${JSON.stringify(data, null, 2)}
    `;

        // Log the formatted message
        logger.info(logMessage);
    }


    private createSklEvent(event: SklEvent, message: GateEvent, group: ConnectorGroup): Serializable[] {
        const self = this;


        if (event == 'OrderStatusUpdate') {
            // Process the 'result' array that contains the list of orders
            const gateOrderStatusEvent = message.result;  // This is an array of order objects
            //logger.log(`Processing ${gateOrderStatusEvent} order status updates`);

            //logger.log(`Processing ${JSON.stringify(message.result)} to see `);

            if (Array.isArray(gateOrderStatusEvent)) {
                logger.log(`we are here`);
                const sklOrders: OrderStatusUpdate[] = gateOrderStatusEvent.map((order: GateOrderStatus) => {
                    return self.createOrderStatusUpdate(order);  // Process each order
                });

                if (sklOrders.length > 0) {
                    return sklOrders;
                } else {
                    logger.log(`No valid messages generated for event: ${JSON.stringify(message)}`);
                }
            } else {
                logger.log(`Unexpected result format: ${JSON.stringify(message.result)}`);
            }
        }

        logger.log(`Unhandled event: ${event}`);
        return [];
    }

    private genSign(method: string, url: string, queryString: string | null = null, payloadString: string | null = null): { KEY: string; Timestamp: string; SIGN: string } {
        const t = Math.floor(Date.now() / 1000); // Get current time in seconds
        const hashedPayload = crypto.createHash('sha512').update(payloadString || "").digest('hex');
        const s = `${method}\n${url}\n${queryString || ""}\n${hashedPayload}\n${t}`;
        const sign = crypto.createHmac('sha512', this.apiSecret).update(s).digest('hex');
        return { KEY: this.apiKey, Timestamp: String(t), SIGN: sign };
    }

    public async getRequest(endpoint: string, paramsData: any) {
        const currentTime = Math.floor(Date.now() / 1000);
        const path = this.route + endpoint;

        // Construct query parameters
        const paramKeys = Object.keys(paramsData);
        let params = paramKeys.length > 0 ? "?" : "";
        for (const key of paramKeys) {
            params += key + "=" + encodeURIComponent(paramsData[key]) + "&";
        }

        // Remove trailing "&"
        if (params.endsWith("&")) {
            params = params.slice(0, -1);
        }

        // Prepare the signature
        const signHeaders = this.genSign("GET", this.route + endpoint, params);

        // Construct the URL for the GET request
        const url = this.restUrl + path + params;

        // Set headers with the signature
        const headers = {
            ...signHeaders,
            "Accept": "application/json",
            "Content-Type": "application/json"
        };

        console.log(`GET ${url}`);

        try {
            // Perform the GET request using axios
            const response = await axios.get(url, { headers });
            return response.data;  // Return the response data
        } catch (error) {
            console.error('Error during GET request:', error);
            throw error;
        }
    }



    public async postRequest(endpoint: string, paramsData: any) {
        const currentTime = Math.floor(Date.now() / 1000);
        const path = this.route + endpoint;

        // Construct query parameters
        const paramKeys = Object.keys(paramsData);
        let params = paramKeys.length > 0 ? "?" : "";
        for (const key of paramKeys) {
            params += key + "=" + encodeURIComponent(paramsData[key]) + "&";
        }

        // Remove trailing "&"
        if (params.endsWith("&")) {
            params = params.slice(0, -1);
        }


        // Prepare the signature
        const signHeaders = this.genSign("POST", this.route + endpoint, params);

        // Construct the URL for the POST request
        const url = this.restUrl + path + params;

        // Set headers with the signature
        const headers = {
            ...signHeaders,
            "Accept": "application/json",
            "Content-Type": "application/json"
        };

        console.log(`POST ${url}`);

        try {
            // Perform the GET request using axios
            const response = await axios.get(url, { headers });
            return response.data;  // Return the response data
        } catch (error) {
            console.error('Error during GET request:', error);
            throw error;
        }
    }

    private async postRequestOrder(endpoint: string, body: any): Promise<any> {
        const url = this.restUrl + this.route + endpoint;
        const bodyString = JSON.stringify(body);

        logger.log(`POST ${url} with body: ${bodyString}`);

        // Generate signature
        const signHeaders = this.genSign('POST', this.route + endpoint, '', bodyString);

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...signHeaders
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: bodyString
            });

            // Log the full response for debugging
            logger.log(`Response status: ${response.status}`);
            const responseBody = await response.json();
            logger.log(`Response body: ${JSON.stringify(responseBody)}`);

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(responseBody)}`);
            }

            return responseBody;
        } catch (error) {
            logger.error('Error in postRequestOrder:', error);
            throw error;
        }
    }

    public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
        const self = this;

        // Params to fetch open orders for the specific product (currency pair)
        const params = {};

        // Make the API request to Gate.io for the current active orders
        const promise: Promise<OrderStatusUpdate[]> = self.getRequest("/spot/open_orders", params)
            .then((res: GateOpenOrderResponse) => {
                logger.log(`Open orders: ${JSON.stringify(res)}`);

                // Map the raw orders data to the OrderStatusUpdate format
                const orders = res.orders.map((order: GateOpenOrder) => {
                    return self.createOpenOrderResponse(order);
                });

                return orders;  // Return the list of standardized orders
            });

        return promise;
    }

    public async placeOrders(request: BatchOrdersRequest): Promise<any> {
        logger.log(`Placing orders: ${JSON.stringify(request)}`);

        const orders = request.orders.map((o) => {
            const order = {
                text: `t-${Date.now()}`,  // Create a unique identifier, or use any provided by the user
                currency_pair: `${this.group.name}_${this.config.quoteAsset}`,  // e.g., BTC_USDT
                side: o.side,  // buy or sell
                amount: o.amount.toString(),  // Size of the order in base currency
                price: o.price ? o.price.toString() : null,  // Price per unit in quote currency (required for limit orders)
                type: "limit",  // Limit order
                time_in_force: 'gtc',  // Good-Till-Cancelled
                account: 'spot',  // Account type
                iceberg: '0'  // Iceberg order size (default 0 for no iceberg)
            };
            return order;
        });

        const responses: Promise<any>[] = orders.map(async (order) => {
            try {
                const res = await this.postRequestOrder("/spot/orders", order);
                return res;
            } catch (error) {
                logger.error(`Error placing order for ${order.currency_pair}`, error);
                throw error;
            }
        });

        // Log the actual response objects after they are all resolved
        const orderResults = await Promise.all(responses);
        logger.log(`Order results: ${JSON.stringify(orderResults)}`);

        return orderResults;
    }

    public async deleteAllOrders(currencyPair?: string, side?: string, account?: string, actionMode: string = 'FULL'): Promise<any> {
        const endpoint = '/spot/orders';

        // Construct query parameters
        const params = new URLSearchParams();

        if (currencyPair) {
            params.append('currency_pair', currencyPair);  // e.g., BTC_USDT
        }

        if (side) {
            params.append('side', side);  // Can be 'buy' or 'sell'
        }

        if (account) {
            params.append('account', account);  // e.g., 'spot', 'unified', 'cross_margin'
        }

        params.append('action_mode', actionMode);  // Processing mode, default is 'FULL'

        const queryString = params.toString();
        const url = `${this.restUrl}${this.route}${endpoint}?${queryString}`;

        logger.log(`DELETE ${url}`);

        // Generate signature
        const signHeaders = this.genSign('DELETE', this.route + endpoint, queryString);

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...signHeaders
        };

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const responseBody = await response.json();
            logger.log(`Cancellation response: ${JSON.stringify(responseBody)}`);
            return responseBody;
        } catch (error) {
            logger.error('Error cancelling orders:', error);
            throw error;
        }
    }


    private createOpenOrderResponse = (order: GateOpenOrder): OrderStatusUpdate => {
        const self = this;

        // Map event types to the order state
        const state: OrderState = websocketOrderUpdateStateMap[order.status] || 'Placed';  // Default to 'Placed' if unknown status

        // Map the order side (buy/sell)
        const side: Side = order.side.toLowerCase() === 'buy' ? 'Buy' : 'Sell';

        // Parse the necessary fields
        const price = parseFloat(order.price);  // Parse the price
        const size = parseFloat(order.amount);  // Total order size
        const filledSize = parseFloat(order.filled_total);  // Amount already filled
        const notional = price * size;  // Calculate the notional value

        // Create and return the OrderStatusUpdate object
        return {
            symbol: self.sklSymbol,
            connectorType: 'Gate',  // Indicate this is from Gate.io
            event: 'OrderStatusUpdate',
            state,  // Current order state (e.g., 'Placed', 'Filled', 'Cancelled')
            orderId: order.id,  // Order ID from Gate.io
            sklOrderId: order.text,  // User-defined order ID (if applicable)
            side,  // Order side (Buy/Sell)
            price,  // Order price
            size,  // Total size of the order
            notional,  // Notional value of the order (price * size)
            filled_price: parseFloat(order.avg_deal_price),  // Average fill price
            filled_size: filledSize,  // Amount filled so far
            timestamp: Date.now(),  // Use the current timestamp
        };
    }

    private createOrderStatusUpdate = (order: GateOrderStatus): OrderStatusUpdate => {
        const self = this;

        // Define the order state based on the 'finish_as' field
        const stateMap: { [key: string]: OrderState } = {
            'open': 'Placed',     // Order is still open
            'filled': 'Filled',   // Order has been fully filled
            'cancelled': 'Cancelled',  // Order has been cancelled
            'ioc': 'Cancelled',   // Immediate or Cancelled
            'stp': 'Cancelled',   // Cancelled due to self-trade prevention
        };

        const state: OrderState = stateMap[order.finish_as] || 'Placed';  // Default to 'Placed' if no match
        const side: Side = order.side.toLowerCase() === 'buy' ? 'Buy' : 'Sell';  // Determine buy/sell side
        const price = parseFloat(order.price);  // Parse order price
        const filledSize = parseFloat(order.amount) - parseFloat(order.left);  // Calculate filled size
        const remainingSize = parseFloat(order.left);  // Remaining size to fill
        const size = parseFloat(order.amount);  // Total order size
        const notional = price * size;  // Notional value of the order

        return {
            symbol: self.sklSymbol,
            connectorType: 'Gate',  // Specify the connector type (Gate.io)
            event: 'OrderStatusUpdate',  // Event type: 'OrderStatusUpdate'
            state,  // Current state of the order (e.g., 'Placed', 'Filled', 'Cancelled')
            orderId: order.id,  // Unique order ID
            sklOrderId: order.text,  // User-defined order ID (if available)
            side,  // Buy or Sell
            price,  // Order price
            size,  // Total size of the order
            notional,  // Notional value of the order (price * size)
            filled_price: parseFloat(order.avg_deal_price),  // Average fill price
            filled_size: filledSize,  // Filled size
            timestamp: Date.now(),  // Timestamp for the event
        };
    };

    // Function to get balance percentage by fetching balances and prices
    public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
        const endpoint = '/spot/accounts';
        const walletBalancesRes = await this.getRequest(endpoint, {});

        // Log wallet balances to debug
        console.log('Wallet Balances:', walletBalancesRes);

        // Find USDT and base (e.g., BTC) balances
        const usdt = walletBalancesRes.find((account: any) => account.currency === this.config.quoteAsset);
        const base = walletBalancesRes.find((account: any) => account.currency === this.group.name);

        if (!usdt) {
            throw new Error(`USDT balance not found in the wallet`);
        }

        if (!base) {
            throw new Error(`Base currency ${this.group.name} balance not found in the wallet`);
        }

        // Fetch the current price of the base asset (e.g., BTC/USDT)
        const priceEndpoint = '/spot/tickers';
        const priceData = await this.getRequest(priceEndpoint, { currency_pair: `${this.group.name}_${this.config.quoteAsset}` });
        const lastPrice = parseFloat(priceData[0].last); // Assuming priceData is an array

        // Calculate values in the quote asset (e.g., USDT)
        const baseValue = (parseFloat(base.available) + parseFloat(base.locked)) * lastPrice;
        const usdtValue = parseFloat(usdt.available) + parseFloat(usdt.locked);
        const whole = baseValue + usdtValue;
        const pairPercentage = (baseValue / whole) * 100;

        return {
            event: 'BalanceResponse',
            symbol: this.sklSymbol,
            baseBalance: parseFloat(base.available) + parseFloat(base.locked),
            quoteBalance: usdtValue,
            inventory: pairPercentage,
            timestamp: new Date().getTime(),
        };
    }

    private gen_sign(channel: string, event: string, timestamp: number): object {
        // const { apiKey, apiSecret } = this.credential;

        const apiKey = this.apiKey
        const apiSecret = this.apiSecret;

        // Construct the payload to be signed
        const payload = `channel=${channel}&event=${event}&time=${timestamp}`;

        // Create the HMAC signature using the API secret
        const signature = crypto
            .createHmac('sha512', apiSecret)
            .update(payload)
            .digest('hex');

        // Return the authentication object with API key and signature
        return {
            method: "api_key",
            KEY: apiKey,
            SIGN: signature,
        };
    }

    private subscribeToProducts(channel: string): void {
        const self = this;

        const products = [self.gateSymbol]

        const current_time = Math.floor(Date.now() / 1000);
        const auth = self.gen_sign(channel, 'subscribe', current_time);

        const subscriptionMessage = {
            time: current_time,
            channel: channel,
            event: "subscribe",
            payload: products,
            auth,

        };
        self.publicWebsocketFeed.send(JSON.stringify(subscriptionMessage));
        logger.info(`Subscribed to channel: ${channel}.${self.gateSymbol}`);
    }


    public async unsubscribeToProducts(channel: string): Promise<void> {
        const self = this;
        const products = [self.gateSymbol];
        const current_time = Math.floor(Date.now() / 1000);
        const auth = self.gen_sign(channel, 'unsubscribe', current_time);
        if (self.publicWebsocketFeed) {
            const unsubscribeMessage = {
                time: current_time,
                channel: channel,
                event: "unsubscribe",
                payload: products,
                auth,
            };
            self.publicWebsocketFeed.send(JSON.stringify(unsubscribeMessage));
            self.publicWebsocketFeed.send(JSON.stringify(unsubscribeMessage));
            self.publicWebsocketFeed.close();
            logger.info('Public WebSocket connection closed and unsubscribed from channels');
        }
    }
}
