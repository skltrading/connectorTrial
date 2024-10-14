// creating these types so it would be easier for me to test

export interface TopOfBook {
    symbol: string;
    connectorType: string;
    event: string;
    timestamp: number;
    askPrice: number;
    askSize: number;
    bidPrice: number;
    bidSize: number;
}

export interface Trade {
    symbol: string;
    connectorType: string;
    event: string;
    price: number;
    size: number;
    side: string;  // true or false
    timestamp: number;
}

export interface Ticker {
    symbol: string;           
    connectorType: 'Binance';    
    event: 'Ticker';         
    lastPrice: number;          
    timestamp: number;           
}

export interface Credential {
    key: string,
    secret: string
}

interface OrderEvent {
    symbol: string;
    connectorType: 'Mexc'; 
    event: string; 
    state: string;  
    orderId: number;   
    sklOrderId: string; 
    side: string;       
    price: number;
    size: string;           
    notional: number;      
    filled_price: number;     
    filled_size: number;
    timestamp: number;         
}

export type SklEvent = 'TopOfBook' | 'Trade' | 'Ticker' | 'Ping';

export type AllActiveOrder = {
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    price: string;
    origQty: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
    stopPrice: string;
    icebergQty: string;
    time: number;
    updateTime: number;
    isWorking: boolean;
    origQuoteOrderQty: string;
    workingTime: number;
    selfTradePreventionMode: string;
}[];

export type AccountInfo = {
    makerCommission: number;
    takerCommission: number;
    buyerCommission: number;
    sellerCommission: number;
    commissionRates: {
        maker: string;
        taker: string;
        buyer: string;
        seller: string;
    };
    canTrade: boolean;
    canWithdraw: boolean;
    canDeposit: boolean;
    brokered: boolean;
    requireSelfTradePrevention: boolean;
    preventSor: boolean;
    updateTime: number;
    accountType: string;
    balances: Array<{
        asset: string;
        free: string;
        locked: string;
    }>;
    permissions: string[];
    uid: number;
};

export interface BinanceOrderProgress {
    e: string,
    s: string;
    S: string  
    i: number;       
    c: string; 
    p: number;             
    q: number;            
    z: number;          
    Z: number;         
    E: number;            
    x: string;
    X: string;
    o: string;              
}

export interface OrderAckResponse {
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    transactTime: number;
}

export interface OrderResultResponse {
    symbol: string;
    orderId: number;
    orderListId: number;
    clientOrderId: string;
    transactTime: number;
    price: string;
    origQty: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    status: string;
    timeInForce: string;
    type: string;
    side: string;
    workingTime: number;
    selfTradePreventionMode: string;
}

export interface OrderFullResponse extends OrderResultResponse {
    fills: {
        price: string;
        qty: string;
        commission: string;
        commissionAsset: string;
        tradeId: number;
    }[];
}

export interface CancelSingleOrderData {
    symbol: string;                       
    orderId?: number;                  
    origClientOrderId?: string;  
    newClientOrderId?: string;   
    cancelRestrictions?: 'ONLY_NEW' | 'ONLY_PARTIALLY_FILLED'; 
    recvWindow?: number;          
    timestamp: number; 
}

export type placeOrderData = {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    quantity: number;
    price: number;
    stopPrice?: number;
    newClientOrderId?: string;
    icebergQty?: number;
    newOrderRespType?: 'ACK' | 'RESULT' | 'FULL';
    recvWindow?: number;
    timestamp?: number;
};