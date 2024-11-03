import axios from 'axios'
import { URLSearchParams } from 'url'
import { BTCTURK_REST_URL, getRestAuthHeaders } from './utils'
import {
    BtcTurkAllOrdersResult,
    BtcTurkAssetsResult,
    BtcTurkOpenOrdersResult,
    BtcTurkResultGeneric,
    BtcTurkSubmitOrderParams,
    BtcTurkSubmitOrderResult
} from './types'

export interface IBtcTurkRestClient {
    apiBaseUrl: string
    publicKey?: string
    // raw REST request methods
    delete: (
        path: string,
        urlParams?: any | URLSearchParams
    ) => Promise<any>
    get: (
        path: string,
        urlParams?: any | URLSearchParams
    ) => Promise<any>
    post: (
        path: string,
        data?: object,
        urlParams?: any | URLSearchParams
    ) => Promise<any>

    // endpoint specific methods
    getAccountBalance: () => Promise<BtcTurkAssetsResult>

    order: {
        create: (params: BtcTurkSubmitOrderParams) => Promise<BtcTurkSubmitOrderResult>,
        delete: (id: string) => Promise<BtcTurkResultGeneric>,
        getAllOrders: (
            pairSymbol: string,
            startTime?: number,
            endTime?: number,
            page?: number,
            limit?: string, // default: 100, max: 1000
            orderId?: number, // If orderId set, it will return all orders greater than or equals to this order id)
        ) => Promise<BtcTurkAllOrdersResult>,
        getOpenOrders: (pairSymbol: string) => Promise<BtcTurkOpenOrdersResult>,
    }
}

export class BtcTurkRestClient implements IBtcTurkRestClient {
    public retryDelayPromise: Promise<any> | null = null

    constructor(
        public publicKey?: string,
        private privateKey?: string,
        public logger?: { log: (...args: any[]) => void },
        public apiBaseUrl: string = BTCTURK_REST_URL,
    ) { }

    /**
     * @name    delete
     * @summary submit raw "DELETE" request to the BtcTurk API
     * 
     * @param   {string}  path 
     * @param   {any | URLSearchParams}  urlParams 
     * 
     * @returns {Promise<any>} result
     */
    public delete = async (
        path: string,
        urlParams?: any | URLSearchParams,
        retryCount = 3,
    ): Promise<any> => {
        // in-case rate limit exceeded wait until new requests can be made
        !!this.retryDelayPromise && await this.retryDelayPromise

        if (!path.startsWith('/')) path = `/${path}`

        const paramsStr = new URLSearchParams(urlParams || {}).toString()
        const url = `${this.apiBaseUrl}${path}?${paramsStr}`
        const headers = !this.privateKey || !this.publicKey
            ? {}
            : getRestAuthHeaders(this.publicKey, this.privateKey)
        const options = { headers: headers }
        const result = await axios
            .delete(url, options)
            .then(getResultData)
            .catch(rejectWithErrorOrRetry(
                this,
                this.delete,
                [path, urlParams, retryCount - 1],
            ))

        return result
    }

    /**
     * @name    get
     * @summary submit raw "GET" request to the BtcTurk API
     * 
     * @param   {string}  path 
     * @param   {any | URLSearchParams}  urlParams 
     * 
     * @returns {Promise<any>} result
     */
    public get = async (
        path: string,
        urlParams?: any | URLSearchParams,
        retryCount = 3,
    ): Promise<any> => {
        // in-case rate limit exceeded wait until new requests can be made
        !!this.retryDelayPromise && await this.retryDelayPromise

        if (!path.startsWith('/')) path = `/${path}`

        const paramsStr = new URLSearchParams(urlParams || {}).toString()
        const url = `${this.apiBaseUrl}${path}?${paramsStr}`
        const headers = !this.privateKey || !this.publicKey
            ? {}
            : getRestAuthHeaders(this.publicKey, this.privateKey)
        const options = { headers: headers }
        const result = await axios
            .get(url, options)
            .then(getResultData)
            .catch(rejectWithErrorOrRetry(
                this,
                this.get,
                [path, urlParams, retryCount - 1],
            ))

        return result
    }

    public getAccountBalance = async (): Promise<BtcTurkAssetsResult> => this.get('/v1/users/balances')


    /**
     * @name    post
     * @summary submit raw "POST" request to the BtcTurk API
     * 
     * @param   {string}  path 
     * @param   {object}  data 
     * @param   {any | URLSearchParams}  urlParams 
     * 
     * @returns {Promise<any>} result
     */
    public post = async (
        path: string,
        data: object = {},
        urlParams?: any | URLSearchParams,
        retryCount = 3,
    ): Promise<any> => {
        // in-case rate limit exceeded wait until new requests can be made
        !!this.retryDelayPromise && await this.retryDelayPromise

        if (!path.startsWith('/')) path = `/${path}/`

        const paramsStr = new URLSearchParams(urlParams || {}).toString()
        const url = `${this.apiBaseUrl}${path}?${paramsStr}`
        const headers = !this.privateKey || !this.publicKey
            ? {}
            : getRestAuthHeaders(this.publicKey, this.privateKey)
        const options = { headers }
        const result = await axios
            .post(
                url,
                JSON.stringify(data),
                options
            )
            .then(getResultData)
            .catch(rejectWithErrorOrRetry(
                this,
                this.post,
                [path, data, urlParams, retryCount - 1],
            ))

        return result
    }

    order = {
        create: async (params: BtcTurkSubmitOrderParams): Promise<BtcTurkSubmitOrderResult> => await this.post(
            '/v1/order',
            params,
        ),

        delete: async (id: string): Promise<BtcTurkResultGeneric> => await this.delete(
            '/v1/order',
            { id },
        ),

        getAllOrders: async (
            pairSymbol: string,
            startTime?: number,
            endTime?: number,
            page?: number,
            limit?: string, // default: 100, max: 1000
            orderId?: number, // If orderId set, it will return all orders greater than or equals to this order id
        ): Promise<BtcTurkAllOrdersResult> => await this.get(
            '/v1/allOrders',
            {
                pairSymbol,
                startTime,
                endTime,
                page,
                limit,
                orderId
            },
        ),

        getOpenOrders: async (pairSymbol: string): Promise<BtcTurkOpenOrdersResult> => await this.get(
            '/v1/openOrders',
            pairSymbol,
        )
    }
}
export default BtcTurkRestClient

const getResultData = (result: any) => result?.data

const rejectWithErrorOrRetry = (
    instance: BtcTurkRestClient,
    func: any,
    args: any[],
) => (err: any): Promise<Error> => {
    const data = err?.response?.data || err?.data || {}

    const { details = '', message = '', period = '' } = data
    const retryCount = Number(args.slice(-1)[0]) || 0
    const retry = message === 'TOO_MANY_REQUESTS'
        && !!period
        && retryCount > 0
    if (retry) {
        instance.logger?.log(`BtcTurk: ${details}`)

        // convert period to milliseconds
        const delayMS = periodToMs(period)
        // rate limit exceeded. retry after given duration in "period"
        instance.retryDelayPromise = new Promise(resolve => setTimeout(() => {
            resolve(true)
        }, delayMS))
        return new Promise(async (resolve, reject) => {
            await instance.retryDelayPromise
            try {
                const result = func.call(instance, ...args)
                resolve(result)
            } catch (err) {
                reject(err)
            }
        })
    }
    err = new Error(data.message)
    err.code = data.code
    return Promise.reject(err)
}

const periodToMs = (period: string): number => {
    const num = Number(
        [...period.matchAll(/[0-9]/g)]
            .map(x => x?.[0] || '')
            .join('')
    )
    const name = [...period.matchAll(/[a-zA-Z]/g)]
        .map(x => x?.[0] || '')
        .join('')
        .toLowerCase()
    const multiplier = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    }[name] || 60 * 1000
    return num * multiplier
}