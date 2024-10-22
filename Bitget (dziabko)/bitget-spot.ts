import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';

export type BitgetSide = 'BUY' | 'SELL' | undefined

export const BitgetSideMap: { [key: string]: Side } = {
    'buy': 'Buy',
    'sell': 'Sell'
}

export const BitgetStringSideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

export const BitgetInvertedSideMap: { [key: string]: BitgetSide } = {
    'Buy': 'BUY',
    'Sell': 'SELL'
}

export const getBitgetSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}