export interface ConnectorConfiguration {
    baseURL: string;
    quoteAsset: string;
    connectorType: string;
  }
  
  export interface ConnectorGroup {
    name: string;
  }
  
  export interface Credential {
    key: string;
    secret: string;
  }
  
  export type Side = 'Buy' | 'Sell';
  export type OrderState = 'Placed' | 'Filled' | 'PartiallyFilled' | 'Cancelled' | 'CancelledPartiallyFilled';
  
  export interface Serializable {
    event: SklEvent;
    timestamp: number;
    symbol: string;
    connectorType: string;
  }
  
  export type SklEvent = 'Trade' | 'TopOfBook' | 'Ticker' | 'PriceChange' | 'DepthUpdate' | 'Candlestick' | 'BalanceResponse' | 'TradeUpdate';


  export interface PriceChange extends Serializable {
    price: number;
}

export interface DepthUpdate extends Serializable {
    asks: { price: number, quantity: number }[];
    bids: { price: number, quantity: number }[];
}

export interface TradeUpdate extends Serializable {
    price: number;
    quantity: number;
    side: Side;
}

export interface Candlestick extends Serializable {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
}

  
  export interface Trade extends Serializable {
    price: number;
    size: number;
    side: Side;
  }
  
  export interface TopOfBook extends Serializable {
    bidPrice: number;
    bidSize: number;
    askPrice: number;
    askSize: number;
  }
  
  export interface Ticker extends Serializable {
    lastPrice: number;
  }
  
  export interface OrderStatusUpdate extends Serializable {
    orderId: string;
    sklOrderId: string;
    state: OrderState;
    side: Side;
    price: number;
    size: number;
    notional: number;
    filled_price: number;
    filled_size: number;
  }
  
  export interface BalanceRequest {
    symbol?: string;
    event: string;
    timestamp: number;
    connectorType: string;
}

export interface BalanceResponse extends Serializable {
    balances: {
        asset: string;
        available: string;
        total: string;
    }[];
}

  
  export interface OpenOrdersRequest {
    symbol: string;
  }
  
  export interface CancelOrdersRequest {
    side : string;
    symbol: string;
    event: string;
    timestamp: number;
    connectorType: string;
  }
  
  export interface BatchOrdersRequest {
    orders: OrderRequest[];
  }
  
  export interface OrderRequest {
    price: number;
    size: number;
    side: Side;
    type: string;
  }


  
  export interface WebSocketMessage {
    event: string;
    channel: string;
    data: any;
  }
  
  export interface WebSocketEvent {
    type: string;
    data: any;
  }
  
  export interface PrivateExchangeConnector {
    connect(onMessage: (m: Serializable[]) => void): Promise<void>;
    stop(cancelOrders?: boolean): Promise<void>;
    placeOrders(request: BatchOrdersRequest): Promise<any>;
    getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]>;
    getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse>;
    deleteAllOrders(request: CancelOrdersRequest): Promise<void>;
  }
  
  export interface PublicExchangeConnector {
    connect(onMessage: (m: Serializable[]) => void): Promise<void>;
    stop(): Promise<void>;
  }
  
  export interface Logger {
    log: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
    info: (message: string) => void;
  }

  // Define Order Type
export interface Order {
    orderId: string;
    symbol: string;
    side: string;
    price: number;
    size: number;
    status: string;
    timestamp: number;
}


  