
import * as crypto from 'crypto'

export const BTCTURK_WS_URL = process.env.BTCTURK_WS_URL || 'wss://ws-feed-pro.btcturk.com'
// individual endpoints will start with /api/v1... or /api/v2...
export const BTCTURK_REST_URL = process.env.BTCTURK_REST_URL || 'https://api.btcturk.com/api'
export enum BtcTurk_WS_TYPE {
    connected = 991, // on connect message.
    subscribeResult = 100, //
    orderDeletePayload = 201, // a messaged received before the order delete confirmation message

    OrderBookFull = 431,
    Request = 101,
    Result = 100, // response to messages sent { ok: boolean, message: string (eg: "join|trade:BTCTRY")}
    Subscription = 151, // channel to subscribe to any supported events
    TickerPair = 402,
    TickerAll = 401,
    TradeSingle = 422,
    TradeSingleList = 421, // first message received after "trade" subscription is a list of recent trades

    // private types
    OrderDelete = 452,
    OrderInsert = 451,
    OrderUpdate = 453,
    UserLoginRequest = 114,
    UserOrderMatch = 441,
    UserTrade = 423,
}

export const MapMultiResultTypes = {
    [BtcTurk_WS_TYPE.OrderUpdate]: [
        BtcTurk_WS_TYPE.OrderDelete,
        BtcTurk_WS_TYPE.OrderInsert,
    ]
}


// 114 UserLoginResult
export const createWSLoginMsg = (
    publicKey: string,
    privateKey: string,
    // Accepts between 100 and 60000.
    // Sometimes randomly accepts/rejects when lower than 100. 
    // No explanation found in the documentation.
    // https://docs.btcturk.com/websocket-feed/authentication
    nonce: number = 3000
): string => {
    const signature = createSignature(
        privateKey,
        `${publicKey}${nonce}`,
    )
    const message = {
        type: BtcTurk_WS_TYPE.UserLoginRequest,
        publicKey,
        timestamp: new Date().getTime(),
        nonce,
        signature: signature,
    }
    return JSON.stringify([BtcTurk_WS_TYPE.UserLoginRequest, message])
}

// create subscription message
export const createWSSubscribeMsg = (
    channel: string,
    event: string,
    join: true | false = true,// true: subscribe | false:unsubscribe
): string => {
    const params = {
        type: BtcTurk_WS_TYPE.Subscription,
        channel,
        event,
        join,
    }
    return JSON.stringify([
        BtcTurk_WS_TYPE.Subscription,
        params,
    ])
}

export const createSignature = (
    privateKey: string,
    data: string | any,
    algo: string = 'sha256'
) => {
    data = typeof data === 'string'
        ? data
        : JSON.stringify(data)
    const hmac = crypto.createHmac(
        algo,
        Buffer.from(privateKey, 'base64')
    )
    hmac.update(Buffer.from(data, 'utf8'))
    const signature = Buffer
        .from(
            hmac
                .digest()
                .toString('base64'),
            'utf8'
        )
        .toString('utf8')
    return signature
}

export const getRestAuthHeaders = (publicKey: string, privateKey: string) => {
    const stamp = (new Date()).getTime()
    const data = `${publicKey}${stamp}`
    const signature = createSignature(privateKey, data, 'sha256')
    return {
        'Content-type': 'application/json',
        "X-PCK": publicKey,
        "X-Stamp": stamp.toString(),
        "X-Signature": signature,
    }
}

export const deferred = (
    callback: (...args: any[]) => void,
    delayMs: number
) => {
    let tid: NodeJS.Timeout
    return (...args: any[]) => {
        clearTimeout(tid)

        tid = setTimeout(() => {
            callback(...args)
        }, delayMs)
    }
}

export const throttle = (
    callback: (...args: any[]) => void,
    deferMs = 0,
    limit = 0
) => {
    let tid: NodeJS.Timeout | undefined
    let count = 0
    let lastArgs: any[]
    const exec = () => {
        tid = undefined
        clearTimeout(tid)
        count++
        callback(...lastArgs)
    }
    return (...args: any[]) => {
        lastArgs = args
        if (count === 0) return exec()
        if ((limit > 0 && count >= limit)) return clearTimeout(tid) // ignore

        tid ??= setTimeout(exec, deferMs)
    }
}