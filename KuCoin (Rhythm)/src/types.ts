/**
 * Represents the response from the /api/v1/bullet-public and /api/v1/bullet-private endpoint.
 */
export interface BulletResponse {
  code: string;  // Response status code
  data: {
    instanceServers: InstanceServer[]; // List of instance servers
    token: string;  // Authentication token
  };
}

/**
 * Represents an instance server returned by the bullet-public or bullet-private endpoint.
 */
export interface InstanceServer {
  endpoint: string;    // WebSocket server URL
  encrypt: boolean;    // Whether encryption is enabled
  protocol: string;    // Communication protocol (e.g., WebSocket)
  pingInterval: number; // Interval (ms) between ping messages
  pingTimeout: number;  // Timeout (ms) for ping responses
}

/**
 * Represents a generic WebSocket message from KuCoin's API.
 */
export interface WebSocketMessage {
  id?: string;            // Optional message ID
  type: string;           // Message type (e.g., 'ticker', 'order')
  topic?: string;         // Topic of the message (optional)
  response?: boolean;     // Indicates if it's a response
  data?: any;             // Message payload data
  code?: number;          // Status code
  changes?: {             // Changes in order book (optional)
    asks: [string, string][]; // Updated ask prices and sizes
    bids: [string, string][]; // Updated bid prices and sizes
  };
  sequenceStart?: number; // Start sequence number (for updates)
  sequenceEnd?: number;   // End sequence number (for updates)
  symbol?: string;        // Trading pair symbol (e.g., 'BTC-USDT')
  time?: number;          // Timestamp of the message
}

/**
 * Configuration object for the KuCoin Private Connector.
 */
export interface KuCoinConfig {
  apiKey: string;       // API key for authentication
  apiSecret: string;    // API secret for authentication
  apiPassphrase: string; // API passphrase for authentication
}

/**
 * Represents the request to place an order.
 */
export interface PlaceOrderRequest {
  clientOid: string;          // Unique client order ID
  side: 'buy' | 'sell';       // Order side (buy or sell)
  symbol: string;             // Trading pair symbol (e.g., 'BTC-USDT')
  type: 'limit' | 'market';   // Order type (limit or market)
  price?: string;             // Price for limit orders (optional)
  size?: string;              // Size of the asset to trade (optional)
  funds?: string;             // Amount of funds for market orders (optional)
  stop?: 'loss' | 'entry';    // Stop order type (optional)
  stopPrice?: string;         // Stop price (optional)
  remark?: string;            // Remark for the order (optional)
  timeInForce?: 'GTC' | 'IOC' | 'FOK'; // Time in force policy for limit orders
  cancelAfter?: number;       // Auto-cancel after a specified time (optional)
  postOnly?: boolean;         // Post-only flag for limit orders (optional)
  hidden?: boolean;           // Hidden order flag (optional)
  iceberg?: boolean;          // Iceberg order flag (optional)
  visibleSize?: string;       // Visible size for iceberg orders (optional)
}

/**
 * Represents ticker data from KuCoin's API.
 */
export interface TickerData extends WebSocketMessage {
  symbol: string;   // Trading pair symbol
  price: number;    // Latest price of the asset
  time: number;     // Timestamp of the ticker update
}

/**
 * Represents trade data from KuCoin's API.
 */
export interface TradeData extends WebSocketMessage {
  symbol: string;   // Trading pair symbol
  price: number;    // Price at which the trade was executed
  size: number;     // Size of the trade
  time: number;     // Timestamp of the trade
}

/**
 * Represents order book data from KuCoin's API.
 */
export interface OrderBookData extends WebSocketMessage {
  symbol: string;   // Trading pair symbol
  changes: {        // Changes in the order book
    asks: [string, string][]; // Updated ask prices and sizes
    bids: [string, string][]; // Updated bid prices and sizes
  };
  sequenceStart: number; // Start sequence number
  sequenceEnd: number;   // End sequence number
  time: number;          // Timestamp of the update
}

/**
 * Represents match event data from KuCoin's API.
 */
export interface MatchEventData {
  symbol: string;   // Trading pair symbol
  price: number;    // Price at which the match occurred
  size: number;     // Size of the matched order
  side: string;     // Side (buy or sell) of the match
  makerOrderId: string;  // ID of the maker order
  takerOrderId: string;  // ID of the taker order
  tradeId: string;       // Unique trade ID
  time: number;          // Timestamp of the match
}

/**
 * Represents market snapshot data.
 */
export interface MarketSnapshotData {
  symbol: string;       // Trading pair symbol
  bestAsk: number;      // Best ask price
  bestAskSize: number;  // Size at the best ask price
  bestBid: number;      // Best bid price
  bestBidSize: number;  // Size at the best bid price
  price: number;        // Latest price of the asset
  time: number;         // Timestamp of the snapshot
}

/**
 * Represents an account balance message from KuCoin's WebSocket API.
 */
export interface AccountBalanceMessage {
  type: "account.balance"; // Type of the message (balance update)
  data: {
    currency: string;  // Currency (e.g., 'USDT', 'BTC')
    balance: number;   // Total balance
    available: number; // Available balance for trading
    holds: number;     // Amount on hold
  };
}

/**
 * Represents an order creation message from KuCoin's WebSocket API.
 */
export interface OrderCreateMessage {
  type: "order.create"; // Type of the message (order creation)
  data: {
    orderId: string;  // ID of the created order
    symbol: string;   // Trading pair symbol
    size: number;     // Size of the order
    price: number;    // Price at which the order was placed
  };
}

/**
 * Represents an order cancellation message from KuCoin's WebSocket API.
 */
export interface OrderCancelMessage {
  type: "order.cancel";  // Type of the message (order cancellation)
  data: {
    orderId: string;  // ID of the canceled order
    symbol: string;   // Trading pair symbol
  };
}
