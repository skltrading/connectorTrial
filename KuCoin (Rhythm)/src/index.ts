// src/index.ts

import { KuCoinPublicConnector } from './public/kucoin-spot-public-connector';
import { onMessage } from './public/event-handlers';
import {config} from 'dotenv';
import logger from './logger';

config();

const main = async () => {
    const publicConnector = new KuCoinPublicConnector(onMessage);

    // Add desired subscription channels
    publicConnector.addSubscription('/market/ticker:BTC-USDT');
    publicConnector.addSubscription('/market/match:BTC-USDT');
    publicConnector.addSubscription('/market/level2:BTC-USDT');

    await publicConnector.connect();

    const shutdown = async () => {
        logger.info('Shutting down connectors...');
        await publicConnector.stop();
        logger.info('Connectors stopped.');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    setTimeout(async () => {
        await shutdown();
    }, 60000); // 60 seconds
};

main();