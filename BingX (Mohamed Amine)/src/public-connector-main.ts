import {
  ConnectorConfiguration,
  ConnectorGroup,
  PublicExchangeConnector,
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
const connectorInstance: PublicExchangeConnector =
  ConnectorFactory.getPublicConnector(
    connectorGroup,
    connectorConfig,
    credential
  );

connectorInstance.connect((messages: Serializable[]) => {
  console.log(messages);
});
