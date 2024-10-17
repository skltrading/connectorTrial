import { ConnectorConfiguration, ConnectorGroup } from "./utils"

export type BingXTradeSide = 'BUY' | 'SELL'

export const sideMap: { [key: string]: any } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

export const getBingXSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}-${connectorConfig.quoteAsset}`
}