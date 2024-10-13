import {
    ConnectorConfiguration,
    ConnectorGroup,
    Side,
} from '../../types';

// Gate.io-specific side mapping
export type GateTradeSide = 'BUY' | 'SELL' | undefined;

export const GateSideMap: { [key: string]: Side } = {
    'BUY': 'Buy',
    'SELL': 'Sell'
};

// Inverted map for converting internal sides back to Gate.io format
export const GateInvertedSideMap: { [key: string]: GateTradeSide } = {
    'Buy': 'BUY',
    'Sell': 'SELL'
};

// Utility to get the Gate.io symbol from connector configuration
export const getGateSymbol = (symbolGroup: ConnectorGroup, connectorConfig: ConnectorConfiguration): string => {
    return `${symbolGroup.name}_${connectorConfig.quoteAsset}`;
};
