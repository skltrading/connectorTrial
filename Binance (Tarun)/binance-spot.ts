import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';


export type BinanceSide = 'BUY' | 'SELL' | undefined

export const BinanceSideMap: { [key: string]: Side } = {
    'true' : 'SELL',
    'false' : 'BUY'
}

export const BinanceStringSideMap: { [key: string]: Side } = {
    'BUY': 'BUY',
    'SELL': 'SELL'
}

export const BinanceInvertedSideMap: { [key: string]: BinanceSide } = {
    'BUY': 'BUY',
    'SELL': 'SELL'
}

export const getBinanceSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}