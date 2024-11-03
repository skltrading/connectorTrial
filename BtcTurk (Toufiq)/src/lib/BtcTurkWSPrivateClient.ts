import BtcTurkWSClient, { BtcTurkWSSubscribeParams } from './BtcTurkWSClient'
import { BtcTurk_WS_TYPE, createWSLoginMsg } from './utils'

export const BtcTurkWSUserEventChannel = 'U'
export enum BtcTurkWSPrivateEvent {
    OrderDelete = 'OrderDelete',
    OrderInsert = 'orderınsert', // Yes, there is a Turkish alphabet in the middle! Keep it as is.
    OrderUpdate = 'OrderUpdate',
    UserOrderMatch = 'UserOrderMatch',
    UserTrade = 'UserTrade',
}
export const BtcTurkWSPrivateEventType = {
    'OrderDelete': BtcTurk_WS_TYPE.OrderDelete,
    'orderınsert': BtcTurk_WS_TYPE.OrderInsert,
    'OrderUpdate': BtcTurk_WS_TYPE.OrderUpdate,
    'UserOrderMatch': BtcTurk_WS_TYPE.UserOrderMatch,
    'UserTrade': BtcTurk_WS_TYPE.UserTrade,
}

export class BtcTurkWSPrivateClient extends BtcTurkWSClient {
    public loggedIn = false
    private loginResultHandler: any = null

    constructor(
        private publicKey: string,
        private privateKey: string,
        reconnectDelayMS?: number,
        logger?: any,
        private onMessge?: (e: any) => void
    ) {
        const onMessageInterceptor = (e: any) => {
            this.onMessge?.call(this, e)
            if (!this.loginResultHandler) return

            let [type, data] = JSON.parse(e.data as string) as [number, any]
            if (type !== 114) return

            this.loginResultHandler(data.ok, data.message)
            this.loginResultHandler = null
        }
        super(
            reconnectDelayMS,
            logger,
            onMessageInterceptor,
        )
    }

    getSubscribeParam = (
        event: BtcTurkWSPrivateEvent,
        onResult: (result: any) => void,
        // optionals
        onError?: (err?: Error) => void,
        channel: string = BtcTurkWSUserEventChannel,
        type: number = BtcTurkWSPrivateEventType[event],
    ): BtcTurkWSSubscribeParams => ({
        channel,
        event,
        onError,
        onResult,
        type,
    })

    /**
     * @name    login
     * @summary authentication for private connection. Will attempt to connect if not alredy connected
     * @returns 
     */
    public login = (): Promise<Boolean> => new Promise(async (resolve, reject) => {
        if (this.loggedIn) return resolve(true)

        const sendLoginMsgNWait = () => {
            this.loginResultHandler = (ok: Boolean, message: string) => {
                this.logger?.log?.(`login ${ok ? 'success' : 'failed'}. ${message || ''}`)

                ok
                    ? resolve(ok)
                    : reject(message)
            }

            // send the login message
            this.socket?.send(
                createWSLoginMsg(
                    this.publicKey,
                    this.privateKey
                ),
                (err?: Error) => err && reject(err)
            )
        }
        try {
            if (this.connecting) await this.connectionPromise
            if (!this.connected) return this
                .connect()
                .then(connected => connected && sendLoginMsgNWait())

            sendLoginMsgNWait()
        } catch (err) {
            const { message } = err as Error
            this.logger?.log?.(`BtcTurkWSPrivateClient: login failed. ${message}`)
        }
    })
}
export default BtcTurkWSPrivateClient