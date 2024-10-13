import axios from 'axios';
import { WebSocket } from 'ws';
import CryptoJS from 'crypto-js';
import {
    BalanceRequest,
    BalanceResponse,
    BatchOrdersRequest,
    CancelOrdersRequest,
    ConnectorConfiguration,
    ConnectorGroup,
    Credential,
    OpenOrdersRequest,
    OrderState,
    OrderStatusUpdate,
    PrivateExchangeConnector,
    Serializable,
    Side,
    SklEvent,
} from '../../types';
import {
    getGateSymbol,
    GateTradeSide,
    GateSideMap,
} from './gate-spot';
import { Logger } from '../../util/logging';
import { getSklSymbol } from '../../util/config';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';


const logger = Logger.getInstance('gate-spot-private-connector')

export class GateSpotPrivateConnector
    implements PrivateExchangeConnector {
    public publicWebsocketAddress = 'wss://api.gateio.ws/ws/v4/'
    public restUrl = 'https://api.gateio.ws/api/v4'
    private gateSymbol: string
    private sklSymbol: string
    public publicWebsocketFeed: any
    private pingInterval: any
    private tokenRefreshInterval = 1000 * 60 * 1.5;

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        private credential: Credential,
    ) {
        const self = this
        self.gateSymbol = getGateSymbol(self.group, self.config)
        self.sklSymbol = getSklSymbol(self.group, self.config)
    }

    public async connect(onMessage: (m: Serializable[]) => void): Promise<any> {
        const self = this
        const publicFeed = new Promise(async (resolve) => {






            const url = self.publicWebsocketAddress;
            self.publicWebsocketFeed = new WebSocket(url);
            self.publicWebsocketFeed.on('open', () => {
                self.subscribeToProducts('spot.ping');
                self.pingInterval = setInterval(() => {
                    console.error(`Resubscribing to private channels: ${self.sklSymbol}`);
                    self.subscribeToProducts('spot.ping');
                }, this.tokenRefreshInterval);

                resolve(true);
            });
        });

    }


    private subscribeToProducts(channel: string): void {
        const self = this;

        const products = [self.gateSymbol]
        const current_time = Math.floor(Date.now() / 1000);

        const subscriptionMessage = {
            time: current_time,
            channel: channel,
            event: "subscribe",
            payload: products,
        };

        self.publicWebsocketFeed.send(JSON.stringify(subscriptionMessage));
        logger.info(`Subscribed to channel: ${channel}.${self.gateSymbol}`);
    }




}