/**
 * Represents the response from the /api/v1/bullet-public endpoint.
 */
export interface BulletPublicResponse {
  code: string;
  data: {
      instanceServers: InstanceServer[];
      token: string;
  };
}

/**
* Represents an instance server returned by the bullet-public endpoint.
*/
export interface InstanceServer {
  endpoint: string;
  encrypt: boolean;
  protocol: string; // Changed from 'protocols' to 'protocol'
  pingInterval: number;
  pingTimeout: number;
}

/**
* Represents a generic WebSocket message from KuCoin's API.
*/
export interface WebSocketMessage {
  id?: string;
  type: string;
  topic?: string;
  response?: boolean;
  data?: any;
  code?: number;
  // For order book updates
  changes?: {
      asks: [string, string][];
      bids: [string, string][];
  };
  sequenceStart?: number;
  sequenceEnd?: number;
  symbol?: string;
  time?: number;
}

/**
* Configuration object for the KuCoin Private Connector.
*/
export interface KuCoinConfig {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

export interface BulletPrivateResponse {
  code: string;
  data: {
    instanceServers: InstanceServer[];
    token: string;
  };
}

export interface PlaceOrderRequest {
  clientOid: string;        // Unique client order ID
  side: 'buy' | 'sell';     // Order side: buy or sell
  symbol: string;           // Trading pair symbol, e.g., 'BTC-USDT'
  type: 'limit' | 'market'; // Order type: limit or market
  price?: string;           // Order price (required for limit orders)
  size?: string;            // Order size (amount of the asset to buy/sell)
  funds?: string;           // Amount of funds to spend (used for market orders)
  stop?: 'loss' | 'entry';  // Optional: stop order type (for stop-loss/entry orders)
  stopPrice?: string;       // Optional: stop price for stop orders
  remark?: string;          // Optional: remark for the order
  timeInForce?: 'GTC' | 'IOC' | 'FOK'; // Time in force policy for limit orders
  cancelAfter?: number;     // Optional: auto-cancel after a specified time (in ms)
  postOnly?: boolean;       // Optional: whether the order is post-only (for limit orders)
  hidden?: boolean;         // Optional: whether the order is hidden (for limit orders)
  iceberg?: boolean;        // Optional: whether the order is an iceberg order
  visibleSize?: string;     // Optional: visible size for iceberg orders
}

export interface TickerData extends WebSocketMessage {
  symbol: string;
  price: number;
  time: number;
}

export interface TradeData extends WebSocketMessage {
  symbol: string;
  price: number;
  size: number;
  time: number;
}

export interface OrderBookData extends WebSocketMessage {
  symbol: string;
  changes: {
    asks: [string, string][];
    bids: [string, string][];
  };
  sequenceStart: number;
  sequenceEnd: number;
  time: number;
}

export interface MatchEventData {
  symbol: string;
  price: number;
  size: number;
  side: string;
  makerOrderId: string;
  takerOrderId: string;
  tradeId: string;
  time: number;
}

export interface MarketSnapshotData {
  symbol: string;
  bestAsk: number;
  bestAskSize: number;
  bestBid: number;
  bestBidSize: number;
  price: number;
  time: number;
}

export interface AccountBalanceMessage {
  type: "account.balance";  // or any other relevant fields
  data: {
      currency: string;      // e.g., 'USDT', 'BTC'
      balance: number;       // balance amount
      available: number;     // available balance for trading
      holds: number;         // amount on hold
  };
}

export interface OrderCreateMessage {
  type: "order.create";
  data: {
      orderId: string;      // The ID of the created order
      symbol: string;       // Trading pair symbol, e.g., 'BTC-USDT'
      size: number;         // Size of the order
      price: number;        // Price at which the order was placed
      // Add other relevant fields
  };
}

export interface OrderCancelMessage {
  type: "order.cancel";
  data: {
      orderId: string;      // The ID of the canceled order
      symbol: string;       // Trading pair symbol
      // Add other relevant fields
  };
}