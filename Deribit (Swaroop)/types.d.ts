export type Serializable = string | number | object

export type OrderBookDepth = 1 | 10 | 20
export type PublicInterval = "agg2" | "100ms"
export type PrivateInterval = PublicInterval | "raw"
export type ETHGroup = 
    |"none"
    | "1"
    | "2"
    | "5"
    | "10"
    | "25"
    | "100"
    | "250"
export type BTCGroup = 
    | "1"
    | "10"
    | "20"
export type ConnectorGroup = BTCGroup | ETHGroup

export type Spread = [string, number, number]

export interface DeribitTopOfBook {
    prev_change_id: number | null // Doesn't exists for first notification
    type: 'snapshot' | 'change';
    timestamp: number;
    instrument_name: string;
    change_id: number;
    // Array of arrays: [status, price, amount] - status [new, change or delete.]
    bids: Spread[];
    asks: Spread[];
}

export interface DeribitTrade {
    trade_id: string,
    contracts: number,
    tick_direction: 1,
    mark_price: number,
    trade_seq: 219530479,
    instrument_name: string,
    index_price: number,
    direction: "buy" | "sell",
    amount: number,
    price: number,
    timestamp: number
}

export interface DeribitTicker {
    timestamp: number;
    stats: {
        volume_usd: number;
        volume: number;
        price_change: number;
        low: number;
        high: number;
    };
    state: 'open' | 'closed' | string;
    settlement_price: number;
    open_interest: number;
    min_price: number;
    max_price: number;
    mark_price: number;
    last_price: number;
    interest_value: number;
    instrument_name: string;
    index_price: number;
    funding_8h: number;
    estimated_delivery_price: number;
    current_funding: number;
    best_bid_price: number;
    best_bid_amount: number;
    best_ask_price: number;
    best_ask_amount: number;
}

export type DeribitDirection = "buy" | "sell"

export interface DeribitEventData { 
    params: { 
        id?: SklEvent
        channel?: string
        data: DeribitTicker | DeribitTopOfBook | DeribitTrade 
    } 
}

export type SklEvent = "Trade" | "TopOfBook" | "Ticker" | "Version" | "Unsubscribe"

export type SklSupportedConnectors = "MEXC" | "Coinbase" | "Deribit"

export interface BasicSklNotificationProps {
    event: SklEvent,
    connectorType: SklSupportedConnectors
    symbol: string,
    timestamp: number,
}

export type SklSide = "Buy" | "Sell"

export interface SklTrade extends BasicSklNotificationProps {
    price: number,
    size: number,
    side: SklSide,
}

export interface SklTicker extends BasicSklNotificationProps {
    lastPrice: number,
}

export interface SklTopOfBook extends BasicSklNotificationProps {
    askPrice: number,
    askSize: number,
    bidPrice: number,
    bidSize: number,
}