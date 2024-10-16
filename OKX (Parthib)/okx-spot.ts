import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';

export type OkxSide = 'BUY' | 'SELL' | undefined

export const OkxSideMap: { [key: string]: Side } = {
    '1': 'Buy',
    '2': 'Sell'
}

export const OkxStringSideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

export const OkxInvertedSideMap: { [key: string]: OkxSide } = {
    'Buy': 'BUY',
    'Sell': 'SELL'
}

export const getOkxSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}