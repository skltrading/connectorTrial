type OrderBookDepth = 1 | 10 | 20
type PublicInterval = "agg2" | "100ms"
type PrivateInterval = PublicInterval | "raw"
type ETHGroup = 
    |"none"
    | "1"
    | "2"
    | "5"
    | "10"
    | "25"
    | "100"
    | "250"
type BTCGroup = 
    | "1"
    | "10"
    | "20"
type ConnectorGroup = BTCGroup | ETHGroup

interface DeribitTopOfBook {
    prev_change_id: number | null // Doesn't exists for first notification
    type: 'snapshot' | 'change';
    timestamp: number;
    instrument_name: string;
    change_id: number;
    // Array of arrays: [status, price, amount] - status [new, change or delete.]
    bids: [string, number, number][];
    asks: [string, number, number][];
}

interface DeribitTrade {
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

interface DeribitTicker {
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

type DeribitDirection = "buy" | "sell"

interface DeribitEventData { 
    params: { 
        data: DeribitTicker | DeribitTopOfBook | DeribitTrade 
    } 
}

type SklEvent = "Trade" | "TopOfBook" | "Ticker"

type SklSupportedConnectors = "MEXC" | "Coinbase" | "Deribit"

interface BasicSklNotificationProps {
    event: SklEvent,
    connectorType: SklSupportedConnectors
    symbol: string,
    timestamp: number,
}

type SklSide = "Buy" | "Sell"

interface SklTrade extends BasicSklNotificationProps {
    price: number,
    size: number,
    side: SklSide,
}

interface SklTicker extends BasicSklNotificationProps {
    lastPrice: number,
}

interface SklTopOfBook extends BasicSklNotificationProps {
    askPrice: number,
    askSize: number,
    bidPrice: number,
    bidSize: number,
}