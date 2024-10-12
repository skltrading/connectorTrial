import { ConnectorConfiguration, ConnectorGroup, Side } from "../../types"

export type CoinbaseTradeSide = 'BUY' | 'SELL'

export const sideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

// Coinbase trades show the side of the MAKER (thanks coinbase!)
export const tradeSideMap: { [key: string]: Side } = {
    'BUY': 'Sell',
    'SELL': 'Buy'
}

export const getCoinbaseSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}-${connectorConfig.quoteAsset}`
}