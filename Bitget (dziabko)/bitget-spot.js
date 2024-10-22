"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBitgetSymbol = exports.BitgetInvertedSideMap = exports.BitgetStringSideMap = exports.BitgetSideMap = void 0;
exports.BitgetSideMap = {
    'buy': 'Buy',
    'sell': 'Sell'
};
exports.BitgetStringSideMap = {
    'BUY': 'Buy',
    'SELL': 'Sell'
};
exports.BitgetInvertedSideMap = {
    'Buy': 'BUY',
    'Sell': 'SELL'
};
const getBitgetSymbol = (symbolGroup, connectorConfig) => {
    return `${symbolGroup.name}${connectorConfig.quoteAsset}`;
};
exports.getBitgetSymbol = getBitgetSymbol;
