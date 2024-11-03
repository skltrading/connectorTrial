import { WebSocket } from 'ws'
import {
    BtcTurkTradeListItem,
    BtcTurkOrderBookResult,
    BtcTurkTicker
} from './types'
import {
    createWSSubscribeMsg,
    BtcTurk_WS_TYPE,
    BTCTURK_WS_URL,
    createWSLoginMsg,
    MapMultiResultTypes
} from './utils'

export type BtcTurkWSSubscribeParams = {
    channel: string, // eg: 'ticker'
    event: string,   // eg: 'BTCUSDT'
    onResult: (result: any) => void,
    onError?: (error?: Error) => void
    type: number, // expect result type. eg: 401
}

export interface IBtcTurkWSClient {
    connected: Boolean
    connecting: Boolean
    ignoreMessageTypes: number[],
    reconnectDelayMS: number
    socket: any

    connect: (
        onMessage?: (e: any) => void,
        onReconnect?: () => void
    ) => Promise<Boolean>

    subscribe: (params: BtcTurkWSSubscribeParams) => any

    subscribeBatch: (allParams: BtcTurkWSSubscribeParams[]) => void

    unsubscribeAll: () => void
}
const KEY_SEPARATOR = ':'

export class BtcTurkWSClient implements IBtcTurkWSClient {
    // subscription callbacks
    protected callbacks = new Map<
        string, // channel:event:type
        ((result: any) => void)[] // 'channel:event' callbacks
    >()
    public connected = false
    public connecting = false
    protected connectionPromise: Promise<Boolean> | null = null
    public ignoreMessageTypes = [
        BtcTurk_WS_TYPE.connected, // on connection message
        BtcTurk_WS_TYPE.UserLoginRequest, // user login message
        BtcTurk_WS_TYPE.orderDeletePayload, // pre-order-delete message
        // an additional message sent when subscribing to single trades.
        // ToDo: use the most recent entry
        BtcTurk_WS_TYPE.TradeSingleList,
    ]
    protected reconnect = true
    protected reconnectTimeoutId: any
    public socket: WebSocket | null = null
    public socketUrl = BTCTURK_WS_URL
    protected unsubscribers = new Map<string, () => void>()

    constructor(
        public reconnectDelayMS = 5000,
        protected logger?: any,
        protected onMessage?: (e: any) => void
    ) { }

    public connect = (
        onMessage?: (e: any) => void,
        onReconnect?: () => void
    ) => {
        this.connectionPromise = new Promise<Boolean>((resolve, reject) => {
            // reuse existing connection
            if (this.socket?.readyState === WebSocket.OPEN) return resolve(true)
            // close existing connection
            if (this.socket) this.socket.close()

            // clear reconnect timeout to avoid creating unnecessary connections
            clearTimeout(this.reconnectTimeoutId)
            this.connecting = true
            this.reconnect = true
            this.socket = new WebSocket(this.socketUrl)

            // handle websocket close event
            this.socket.on('close', (code: any, reason: any) => {
                this.connecting = false
                this.logger?.log?.(`Websocket connection closed: ${code} - ${reason}`)
                if (!this.reconnect) return

                this.reconnectTimeoutId = setTimeout(() => {
                    this.logger?.log?.('Attempting to reconnect...')
                    this.connect(onMessage, onReconnect).then(ok => {
                        // re-establish to all existing subscriptions
                        if (!ok) return

                        onReconnect?.()
                        this.subscribeBatch(
                            [...this.callbacks]
                                .map(([key, callbacks]) => {
                                    const [
                                        channel,
                                        event,
                                        type
                                    ] = key.split(KEY_SEPARATOR)

                                    return callbacks.map(onResult => ({
                                        channel,
                                        event,
                                        type: Number(type),
                                        onResult
                                    }))
                                })
                                .flat()
                        )
                    })
                        .catch(err => this.logger?.log?.(`Reconnect failed: ${err}`))
                }, this.reconnectDelayMS)
            })

            // handle websocket errors
            this.socket.on('error', (error: Error) => {
                this.logger?.log?.(`WebSocket error: ${error.toString()}`);
                reject(error)
            })

            // handle websocket connection opened
            this.socket.on('open', () => {
                this.connecting = false
                resolve(true)
            })

            // handle all messages received from server
            this.socket.onmessage = (e: any) => {
                onMessage?.(e)
                this.onMessage?.call(this, e)
                let [msgType, data] = JSON.parse(e.data as string) as [number, any]
                const {
                    channel,
                    event,
                    message,
                    _type // same as msgType
                } = data

                if (msgType === BtcTurk_WS_TYPE.subscribeResult) {
                    const msgParts = message?.split('|')
                    const joined = msgParts?.[0] === 'join'
                    const msg = [
                        'Subscription',
                        joined ? 'confirmed' : 'cancelled',
                        '=>',
                        msgParts[1]
                    ].join(' ')
                    return this.logger?.log(msg)
                }

                const ignoreMsg = this.ignoreMessageTypes.includes(msgType)
                if (ignoreMsg) return

                const key = this.getCallbackKey(
                    channel,
                    event,
                    msgType
                )
                let callbacks = this.callbacks.get(key)
                const allKeys = [...this.callbacks.keys()]
                const subscribedTypes = allKeys
                    .map(key => key.split(KEY_SEPARATOR)[2])
                if (!callbacks?.length) {
                    // some messages received do no include channel and event.
                    // in that case only matching the type is required
                    const keyIndex = subscribedTypes.indexOf(String(msgType))
                    callbacks = keyIndex >= 0
                        && this.callbacks.get(allKeys[keyIndex])
                        || undefined
                }

                // handle special cases where one subscribed type can receive multiple types of messages.
                // eg: if OrderUpdate (453) is subscribed, then create, delete etc messages will also be received.
                Object.keys(MapMultiResultTypes).forEach(typeStr => {
                    const index = subscribedTypes.indexOf(typeStr)
                    if (index === -1) return

                    callbacks = [
                        ...callbacks || [],
                        ...this.callbacks.get(allKeys[index]) || [],
                    ]
                })

                const noHandler = !callbacks?.length

                if (noHandler) {
                    const msg = `No handler for message: Channel "${channel || ''}" | Event "${event || ''}" | Type ${msgType}`
                    return this.logger?.log?.(msg)
                }

                // invoke subscription callbacks
                callbacks?.forEach(callback => callback?.(data))
            }
        })
        return this.connectionPromise
    }

    private getCallbackKey = (
        channel: string = '',
        event: string = '',
        type: number = -1
    ) => [channel, event, type].join(KEY_SEPARATOR)

    /**
     * @name    subscribe
     * @summary subscribe to events
     * 
     * @param {BtcTurkWSSubscribeParams} params
     * 
     * @returns {Function|undefined} unsubscribe function
     */
    public subscribe = ({
        channel,
        event,
        type,
        onResult,
        onError,
    }: BtcTurkWSSubscribeParams): any => {
        if (!onResult) return
        if (!this.socket?.OPEN) throw new Error('Please ensure websocket is connected before subscribing')

        const key = this.getCallbackKey(
            channel,
            event,
            type
        )
        const callbacks = this.callbacks.get(key) || []
        // avoid duplication subscriptions
        if (callbacks.includes(onResult)) return

        // return function to unsbuscribe from the channel+event
        const unsubscribe = () => new Promise<void>((resolve, reject) => {
            // send a message to server to unsubscribe
            this.socket?.send(
                createWSSubscribeMsg(
                    channel,
                    event,
                    false
                ),
                (err?: Error) => !err
                    ? resolve()
                    : reject(err)
            )
            // remove onResult callback from the list
            const cbs = this.callbacks.get(key) || []
            const index = cbs.indexOf(onResult)
            cbs.splice(index, 1)
            this.callbacks.set(key, cbs)
        })

        this.callbacks.set(key, [...callbacks, onResult])

        this.socket?.send(createWSSubscribeMsg(channel, event, true), onError)

        this.unsubscribers.set(key, unsubscribe)
        return unsubscribe
    }

    /**
     * @name    subscribeBatch
     * @summary batch subscribe to multiple channels
     * 
     * @param   {BtcTurkWSSubscribeParams[]} batchParams 
     * 
     * @returns {Function[]} functions to unsubscribe
     */
    public subscribeBatch = (batchParams: BtcTurkWSSubscribeParams[]): (() => void)[] => batchParams
        .map(params => this.subscribe(params))

    /**
     * @name    unsubscribeAll
     * @summary unsubscribe from all subscriptions
     */
    public unsubscribeAll = async () => await Promise.all(
        [...this.unsubscribers.values()]
            .map(unsubscribe => unsubscribe())
    )

    public stop = () => {
        this.reconnect = false
        this.socket?.close()
    }
}
export default BtcTurkWSClient