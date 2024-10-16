"use strict";
// import {
//     PrivateExchangeConnector,
//     ConnectorConfiguration,
//     ConnectorGroup,
//     Credential,
//     Serializable,
// } from 'skl-shared';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitfinexPublicConnector = void 0;
var ws_1 = __importDefault(require("ws"));
var BitfinexPublicConnector = /** @class */ (function () {
    function BitfinexPublicConnector(
    // private group: ConnectorGroup,
    // private config: ConnectorConfiguration,
    // private credential?: Credential,
    ) {
        console.log('constructor');
        this.symbol = 'tBTCUSD';
        this.publicWebsocketUrl = 'wss://api-pub.bitfinex.com/ws/2';
        this.connect();
    }
    BitfinexPublicConnector.prototype.connect = function () {
        var _this = this;
        console.log('connecting');
        this.websocket = new ws_1.default(this.publicWebsocketUrl);
        this.websocket.onopen = function (e) {
            // this.websocket.send(msg)
            console.log('subscribing');
            _this.subscribeToChannels();
        };
        this.websocket.onmessage = function (e) {
            console.log('receiving message');
            var msgObject = JSON.parse(e.data);
            _this.handleMessage(e.data);
        };
        // this.websocket.on('error', (error: Error) => {
        //     // Handle errors
        // });
        // this.websocket.on('close', () => {
        //     // Reconnect logic
        //     setTimeout(() => {
        //         this.connect(onMessage);
        //     }, 1000); // Reconnect after 1 second
        // });
    };
    BitfinexPublicConnector.prototype.subscribeToChannels = function () {
        console.log('sending subscribe.');
        var msg = JSON.stringify({
            event: 'subscribe',
            channel: 'trades',
            symbol: this.symbol
        });
        this.websocket.send(msg);
    };
    BitfinexPublicConnector.prototype.handleMessage = function (data) {
        var message = JSON.parse(data);
        console.log(message);
    };
    return BitfinexPublicConnector;
}());
exports.BitfinexPublicConnector = BitfinexPublicConnector;
//# sourceMappingURL=bitfinex_public_connector.js.map