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

export type SklEvent = 'TopOfBook' | 'Trade' | 'Ticker' | 'Ping';