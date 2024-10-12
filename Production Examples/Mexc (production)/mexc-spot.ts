import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';

export type MexcSide = 'BUY' | 'SELL' | undefined

export const MexcSideMap: { [key: string]: Side } = {
    '1': 'Buy',
    '2': 'Sell'
}

export const MexcStringSideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

export const MexcInvertedSideMap: { [key: string]: MexcSide } = {
    'Buy': 'BUY',
    'Sell': 'SELL'
}

export const getMexcSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}