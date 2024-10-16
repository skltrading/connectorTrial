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

export interface ConnectorConfig {
    group?: ConnectorGroup
    interval?: PrivateInterval
    orderBookDepth?: OrderBookDepth
}

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
    method: string
    id?: SklEvent
    result?: JSON
    params: { 
        id?: SklEvent
        channel?: string
        data: DeribitTicker | DeribitTopOfBook | DeribitTrade 
    } 
}

export interface DeribitOpenOrder {
    time_in_force: string,
    reduce_only: boolean,
    price: number,
    trigger_price: number
    post_only: boolean,
    order_type: "limit" | "market" | "stop_limit" | "stop_market",
    order_state: "open" | "filled" | "rejected" | "cancelled" | "untriggered",
    order_id: string,
    max_show: number,
    last_update_timestamp: number,
    label: "",
    is_rebalance: boolean,
    is_liquidation: boolean,
    instrument_name: string,
    filled_amount: number,
    direction: DeribitDirection,
    creation_timestamp: number,
    average_price: number,
    api: boolean,
    amount: number
}

export type DeribitCurrencySymbol = 
    | "BTC"
    | "BTC-PERPETUAL"
    | "ETH-PERPETUAL"
    | "ETH"
    | "USDC"
    | "USDT"
    | "EURR"

export type DeribitOpenOrderKind = 
    | "future"
    | "option"
    | "spot"
    | "future_combo"
    | "option_combo"

export type DeribitOpenOrderType = 
    | "all"
    | "limit"
    | "trigger_all"
    | "stop_all"
    | "stop_limit"
    | "stop_market"
    | "take_all"
    | "take_limit"
    | "take_market"
    | "trailing_all"
    | "trailing_stop"

export interface DeribitAccountSummaries {
    // ... lot more fields comes in extended version
    summaries: Array<{
        // ... lot more fields comes
        currency: string
        balance: number
    }>
}

export type SklEvent = "Trade" | "TopOfBook" | "Ticker" | "Version" | "Unsubscribe" | "OrderStatusUpdate" | "AllBalances"

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

export interface SklCurrentActiveOrder extends BasicSklNotificationProps {
    orderId: string,
    sklOrderId: string,
    state: string,
    side: string,
    price: number,
    size: number,
    notional: number,
    filled_price: number,
    filled_size: number,
    timestamp: number,
}