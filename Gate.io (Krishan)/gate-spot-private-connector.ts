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
    getCoinbaseSymbol,
    sideMap
} from './coinbase-spot';
import { Logger } from '../../util/logging';
import { getSklSymbol } from '../../util/config';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';


const logger = Logger.getInstance('gate-spot-private-connector')

export class GateSpotPrivateConnector
    implements PrivateExchangeConnector {
    public publicWebsocketAddress = 'wss://advanced-trade-ws.coinbase.com'
    public restUrl = 'https://api.coinbase.com'