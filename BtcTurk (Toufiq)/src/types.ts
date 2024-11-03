
export type BalanceRequest = {
    lastPrice: number,
}
export type BalanceResponse = {}
type BatchOrderItem = {
    price: number,
    side: 'Buy' | 'Sell',
    size: number,
    type: 'Limit' | 'Market' | 'LimitMaker' | 'ImmediateOrCancel',
}
export type BatchOrdersRequest = {
    orders: BatchOrderItem[],
}
export type CancelOrdersRequest = {}
export type ConnectorConfiguration = {
    quoteAsset: string,
}
export type ConnectorGroup = {
    name: string,
}
export type Credential = {
    key: string,
    secret: string,
}
export type OpenOrdersRequest = {
    status: string,
}
export type OrderState = {}
export type OrderStatusUpdate = {}
export type Serializable = {}
export type Side = {}
export type SklEvent = {}
export type Ticker = {
    symbol: string,
    connectorType: string,
    event: string,
    lastPrice: number,
    timestamp: number,
}
export type TopOfBook = {
    symbol: string,
    connectorType: string,
    event: string,
    timestamp: number, // No timestamp supplied by the API. Using current time
    askPrice: number,
    askSize: number,
    bidPrice: number,
    bidSize: number,
}
export type Trade = {
    symbol: string,
    connectorType: string,
    event: string,
    price: number,
    size: number,
    side: string,
    timestamp: number,
}

export interface PrivateExchangeConnector { }
export interface PublicExchangeConnector { }