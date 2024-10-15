import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';


export type BinanceSide = 'BUY' | 'SELL' | undefined

export const BinanceSideMap: { [key: string]: Side } = {
    'Sell' : 'true',
    'Buy' : 'false'
}

export const BinanceStringSideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
}

export const BinanceInvertedSideMap: { [key: string]: BinanceSide } = {
    'Buy': 'BUY',
    'Sell': 'SELL'
}

export const getBinanceSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`
}

// trying to create getSklSymbol function from skl-library
export const getSklSymbol = (group: any, config: any)=>{
    return `${group.symbol}${config.quoteAsset}`;
}