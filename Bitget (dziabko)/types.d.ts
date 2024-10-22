export type Serializable = string | object
export type SklEvent = "Trade" | "TopOfBook" | "Ticker" | "Version" | "Unsubscribe" | "OrderStatusUpdate" | "AllBalances"
export type SklSupportedConnectors = "MEXC" | "Coinbase" | "Deribit" | "Bitget"

export type SklSide = "Buy" | "Sell"



export interface BasicSklNotificationProps {
    event: SklEvent,
    connectorType: SklSupportedConnectors
    symbol: string,
    timestamp: number,
}

export interface BitgetEventData { 
    action: string,
    arg: {
        instType: string;
        channel: string;
        instId: string;
    },
    data: string[][],
    ts: number,
}
// export interface BitgetEventData { 
//     method: string
//     id?: SklEvent
//     result?: JSON
//     params: { 
//         id?: SklEvent
//         channel?: string
//         data: BitgetTicker | BitgetTopOfBook | BitgetTrade 
//     } 
// }

export type Spread = [string, number, number]

export interface BitgetTopOfBook {
    prev_change_id: number | null // Doesn't exists for first notification
    type: 'snapshot' | 'change';
    timestamp: number;
    instrument_name: string;
    change_id: number;
    // Array of arrays: [status, price, amount] - status [new, change or delete.]
    bids: Spread[];
    asks: Spread[];
}

export interface SklTrade extends BasicSklNotificationProps {
    price: number,
    size: number,
    side: SklSide,
}


export interface BitgetTrade {
    instType: string;  // Instrument Type
    channel: string;  // Channel name
    instId: string; // Instrument ID
    timestamp: number;  // Trade Unix timestamp in ms
    price: string;  // Trade price
    size: string;  // Trade size
    side: string; // Trade side

    // action: string;
    // arg: {
    //     instType: string;
    //     channel: string;
    //     instId: string;
    // };
    // data: string[];
    // ts: number;
}

export interface BitgetTicker {
    action: string;
    arg: {
        instType: string;
        channel: string;
        instId: string;
    };
    data: [{
        instId: string;
        last: string;
        price_change: string;
        open24h: string;
        high24h: string;
        low24h: string;
        bestBid: string;
        bestAsk: string;
        baseVolume: string;
        quoteVolume: string;
        ts: number;
        labeId: string;
        openUtc: string;
        chgUTC: string;
        bidSz: string;
        askSz: string; 
    }];
}

export interface channelRequest {
    args: string[{
            instType: "SP" | "MC", // SP - Spot, MC - Contract/futures
            channel: "ticker" | "trade",
            instId: string,
        }];
}

export interface BitgetSocketMessage{
    event: string;
    code: number;
    msg: string;
}

export interface BitgetSnapshotData {
    accBaseVolume: string,
    cTime: string,
    clientOId: string,
    feeDetail: [{
            feeCoin: string,
            fee: string
        }],
    fillFee: string,
    fillFeeCoin: string,
    fillNotionalUsd: string,
    fillPrice: string,
    baseVolume: string,
    fillTime: string,
    force: string,
    instId: string,
    leverage: string,
    marginCoin: string,
    marginMode: string,
    notionalUsd: string,
    orderId: string,
    orderType: string,
    pnl: string,
    posMode: string,
    posSide: string,
    price: string,
    priceAvg: string,
    reduceOnly: string,
    stpMode: string,
    side: string,
    size: string,
    enterPointSource: string,
    status: string,
    tradeScope: string,
    tradeId: string,
    tradeSide: string,
    uTime: string
}

export interface BitgetSnapshot {
    action: string,
    arg: {
        instType: string,
        channel: string,
        instId: string,
    },
    data: BitgetSnapshotData[],
}

export interface LoginResponse {
    event: string,
    code: string,
    msg: string,
}


export interface BitgetAccountSnapshot {
    action: string,
    arg: {
        instType: string,
        channel: string,
        coin: string,
    },
    data: BitgetAccountBalanceData[],
}
export interface BitgetAccountBalanceData {
    marginCoin: string,
    frozen: string,
    available: string,
    maxOpenPosAvailable: string,
    maxTransferOut: string,
    equity: string,
    usdtEquity: string,
    timestamp: string,
}

export interface BatchFuturesLimitOrdersRequest {
    symbol: string,
    productType: "USDT-FUTURES" | "COIN-FUTURES" | "USDC-FUTURES" | "SUSDT-FUTURES" | "SCOIN-FUTURUES" | "SUSDC-FUTURES",
    marginMode: "crossed" | "isolated",
    marginCoin: string,
    orderList: FuturesLimitOrderRequest[],
}

export interface FuturesLimitOrderRequest {
    size: string,
    side: "buy" | "sell",
    orderType: "limit" | "market",
    force: "gtc" | "post_only" | "ioc" | "fok",
    price: string,
}

export interface FuturesLimitOrderResponse {
    code: string,
    msg: string,
    requestTime: number,
    data: {
        clientOid: string,
        orderId: string,
    }
}

export interface BatchCancelOrdersRequest {
    orderList: CancelOrdersRequest[],
}

export interface CancelOrdersRequest {
    symbol: string,
    productType: string,
    marginCoin: string,
    orderId: string,
    clientOid: string,
}


export interface ActiveOrder {
    symbol: string,
    size: string,
    orderId: string,
    clientOid: string,
    baseVolume: string,
    fee: string,
    price: string,
    priceAvg: string,
    status: string,
    side: string,
    force: string,
    totalProfits: string,
    posSide: string,
    marginCoin: string,
    quoteVolume: string,
    leverage: string,
    marginMode: string,
    enterPointSource: string,
    tradeSide: string,
    posMode: string,
    orderType: string,
    orderSource: string,
    presetStopSurplusPrice: string,
    presetStopLossPrice: string,
    reduceOnly: string,
    cTime: string,
    uTime: string
}

export interface ActiveOrdersResponse {
    code: string,
    data: {
        entrustedList: ActiveOrder[],
        endId: string,
    }
    msg: string,
    requestTime: string
}

export interface OpenOrdersRequest {
    productType: string,
    symbol: string,
}

export interface OrderStatusUpdate {
    event: string,
    symbol: string,
    size: string,
    orderId: string,
    clientOid: string,
    baseVolume?: string,
    fee: string,
    price: number,
    priceAvg: string,
    status: string,
    side: string,
    notional: number,
    force: string,
    totalProfits: string,
    posSide: string,
    marginCoin: string,
    quoteVolume: string,
    leverage: string,
    marginMode: string,
    enterPointSource: string,
    tradeSide: string,
    posMode: string,
    orderType: string,
    orderSource: string,
    presetStopSurplusPrice: string,
    presetStopLossPrice: string,
    reduceOnly: string,
    cTime: string,
    uTime: string
}

export interface BalanceRequest {
    productType: string
}

export interface AccountResponse {
    code: string,
    data: [
        {
            marginCoin: string,
            locked: string,
            available: string,
            crossedMaxAvailable: string,
            isolatedMaxAvailable: string,
            maxTransferOut: string,
            accountEquity: string,
            usdtEquity: string,
            btcEquity: string,
            crossedRiskRate: string,
            unrealizedPL: string,
            coupon: string,
            unionTotalMagin: string,
            unionAvailable: string,
            unionMm: string,
            assetList: [
                {
                    coin: string,
                    balance: string,
                }
            ]
        }
    ],
    msg: string,
    requestTime: string,
}

export interface BalanceResponse {
    event: string,
    symbol: string,
    baseBalance: number,
    inventory: number,
    timestamp: string,
}