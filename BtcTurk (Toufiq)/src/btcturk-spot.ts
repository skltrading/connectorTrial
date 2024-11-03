import {
    ConnectorConfiguration,
    ConnectorGroup,
    OrderState,
    Serializable,
} from './types'
import { BtcTurkSubmitOrderMethod } from './lib/types'

export const CONNECTOR_TYPE = 'BtcTurk'

export const getBtcTurkSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}

export type OnMessage = (messages: Serializable[]) => void

/**
 * @name    mapOrderSide
 * @summary map SKL order side to BtcTurk order type submit order
 */
export enum OrderSideMap {
    'Buy' = 'buy',
    'Sell' = 'sell',
}
export enum OrderSideMapToSKL {
    // all orders list
    Buy = 'Buy',
    Sell = 'Sell',
    // open orders list
    buy = 'Buy',
    sell = 'Sell',
}

export enum OrderStatusMapToSKL {
    Untouched = 'Placed',
    Closed = 'Filled',
    Partial = 'PartiallyFilled',
    Cancelled = 'Cancelled',
    // Closed = 'CancelledPartiallyFilled',
}

/**
 * @name    OrderTypeMap
 * @summary map SKL order type to BtcTurk order method
 */
export enum OrderTypeMap {
    Limit = BtcTurkSubmitOrderMethod.limit,
    Market = BtcTurkSubmitOrderMethod.market,
    LimitMaker = '', // not supported in BtcTurk
    ImmediateOrCancel = '',// not supported in BtcTurk
    // '': BtcTurkOrderMethod.stoplimit, // not supported in SKL
    // '': BtcTurkOrderMethod.stopmarket, // not supported in SKL
}

export const OrderUpdateStateMap: { [key: string]: OrderState } = {
    423: 'Filled',
    441: 'Filled',
    451: 'Placed',
    452: 'Cancelled',
}

/**
 * @name    TradeSideMap
 * @summary map BtcTurk trade side to SKL
 */
export const TradeSideMapToSKL: { [key: string]: string } = {
    0: 'Buy',
    1: 'Sell',
}