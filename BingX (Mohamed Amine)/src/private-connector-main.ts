import {
  ConnectorConfiguration,
  ConnectorGroup,
  PrivateExchangeConnector,
  Serializable,
} from "./connectors/utils.ts";
import { ConnectorFactory } from "./connectors/connector-factory.ts";

const connectorGroup: ConnectorGroup = {
  name: "PEPE",
};
const connectorConfig: ConnectorConfiguration = {
  quoteAsset: "USDT",
};

const API_KEY = "";
const SECRET_KEY = "";

const credential = {
  api: API_KEY,
  secret: SECRET_KEY,
};

const connectorInstance: PrivateExchangeConnector =
  ConnectorFactory.getPrivateConnector(
    connectorGroup,
    connectorConfig,
    credential
  );

connectorInstance
  .connect((messages: Serializable[]) => {
    console.log(messages);
  })
  .then(() => {
    console.log("Connected successfully");
  });

connectorInstance.placeOrders({
  orders: [
    {
      side: "BUY",
      type: "LIMIT",
      quantity: 1,
      price: 67000,
      newClientOrderId: "x",
    },
  ],
});
connectorInstance.deleteAllOrders();
connectorInstance.getCurrentActiveOrders();
connectorInstance.getBalancePercentage().then((x: any) => console.log(x));
