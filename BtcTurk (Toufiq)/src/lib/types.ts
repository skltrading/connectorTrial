export type BtcTurkAsset = {
    asset: string, // eg: "BTC"
    assetname: string, // eg: "Bitcoin"
    balance: string, // eg: "9,7502186644553258"
    locked: string, // eg: "3,3109771999999998"
    free: string, // eg: "6,439241464455326"
    orderFund: string, // eg: "3,3109771999999998"
    requestFund: string, // eg: "0"
    precision: string, // eg: 8
}

export type BtcTurkResultGeneric = {
    success: Boolean,
    message: string, // error/success message
    code: number, // error code
}

export type BtcTurkAssetsResult = BtcTurkResultGeneric & {
    data: BtcTurkAsset[]
}

export type BtcTurkOrder = {
    id: string, // eg: 9932534,
    datetime: string, // eg: 1543996112263,
    type: 'Buy' | 'Sell' | 'buy' | 'sell', // eg: "Buy",
    method: 'Limit' | 'Market' | string, // eg: "Limit",
    price: string, // eg: "20000.00",
    stopPrice: string, // eg: "20000.00",
    quantity: string, // eg: "0.001",
    pairSymbol: string, // eg: "BTCTRY",
    pairSymbolNormalized: string, // eg: "BTC_TRY",
    newOrderClientId: string, // eg: "test"

    // available in open/all orders result
    time: number, //eg: 1543994632920,
    updateTime: number, // eg: 1543994632920,
    status:
    | 'Cancelled'
    | 'Partial' // will include "leftAmount"
    | 'Untouched'

    // available in open orders result
    leftAmount: string, // eg: "0.09733687"
}

/**
 * @param   {String} A amount
 * @param   {String} P price
 */
export type BtcTurkOrderBookItem = {
    A: string, // amount
    P: string, // price
}

export type BtcTurkAllOrdersResult = BtcTurkResultGeneric & {
    data: BtcTurkOrder[]
}

export type BtcTurkOpenOrdersResult = BtcTurkResultGeneric & {
    data: {
        asks: BtcTurkOrder[],
        bids: BtcTurkOrder[],
    }
}

/**
 * @param   {BtcTurkOrderBookItem[]} AO sale orders/asks
 * @param   {BtcTurkOrderBookItem[]} BO purchase order/bids
 */
export type BtcTurkOrderBookResult = {
    CS: number, // change set. sequential number
    PS: string, // pair symbol
    AO: BtcTurkOrderBookItem[], // sales orders
    BO: BtcTurkOrderBookItem[], // purchase orders
}

export type BtcTurkOrderUpdate = {
    type: number,// eg: 451,
    pairId: number,// eg: 60,
    symbol: string,// eg: 'DOTTRY',
    id: number,// eg: 25338545070,
    method: number,// eg: 0,
    userId: number,// eg: 10062194,
    orderType: number,// eg: 1,
    price: string,// eg: '1515.58',
    amount: string,// eg: '6.08',
    numLeft: string,// eg: '6.08',
    denomLeft: string,// eg: '9203.66872832',
    newOrderClientId: string,// eg: 'advanced-android'
}


export enum BtcTurkSubmitOrderMethod {
    limit = 'limit',
    market = 'market',
    stoplimit = 'stoplimit',
    stopmarket = 'stopmarket',
}

export type BtcTurkSubmitOrderParams = {
    quantity: number,
    price: number,
    stopPrice?: number, // required for stop orders only
    newOrderClientId?: string, // GUID if user did not set.
    orderMethod: string,
    orderType: string,
    pairSymbol: string,
}

export type BtcTurkSubmitOrderResult = BtcTurkResultGeneric & {
    data: BtcTurkOrder
}

/**
 * @param   {String}    La price of the last transaction
 */
export type BtcTurkTicker = {
    B: string,
    A: string,
    BA: string,
    AA: string,
    PS: string,
    H: string,
    L: string,
    LA: string,
    O: string,
    V: string,
    AV: string,
    D: string,
    DP: string,
    DS: string,
    NS: string,
    PId: number,
    channel: string,
    event: string,
    type: number
}

export type BtcTurkTickerAllResult = {
    items: BtcTurkTicker[],
    channel: string,
    event: string,
    type: number,
}

export type BtcTurkTickerResult = BtcTurkTicker & {
    channel: string,
    event: string,
    type: number,
}

/**
 * 
 * @param {string}  D   timestamp  (int)
 * @param {string}  I   pair-specific unique trade ID
 * @param {string}  A   amount
 * @param {string}  P   price
 * @param {0|1}     S   side: 0: buy, 1: sell
 */
export type BtcTurkTradeListItem = {
    D: string,
    I: string,
    A: string,
    P: string,
    S: 0 | 1,
}

export type BtcTurkTradeSingle = BtcTurkTradeListItem & {
    channel: string,
    event: string, // pair symbol. eg: BTCUSDT
    type: string, // channel ID
}