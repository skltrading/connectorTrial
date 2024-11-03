import { ConnectorGroup, ConnectorConfiguration } from '../types'

export const getSklSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}-${connectorConfig.quoteAsset}`
}