"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const bitget_spot_public_connector_1 = require("./bitget-spot-public-connector");
const bitget_spot_datahandler_1 = require("./bitget-spot-datahandler");
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Hello, world!");
        // var a = new Serializable[];
        const bitgetConnector = new bitget_spot_public_connector_1.BitgetSpotPublicConnector();
        // Pass serializable MessageChannel to the connector and connect to the Bitget's public websocket
        bitgetConnector.connect(bitget_spot_datahandler_1.onMessage);
        // Wait 5 seconds for the connection to be established, and for the handlers to store some data
        yield delay(5000);
        console.log("End!");
    });
}
main();
