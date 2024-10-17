import { ConnectorConfiguration, ConnectorGroup, Credential, PublicExchangeConnector, PrivateExchangeConnector } from "./utils.ts";
import { BingXSpotPublicConnector } from "./public/bingX-spot-public-connector.ts";
import { BingXSpotPrivateConnector } from "./private/bingx-spot-private-connector.ts";

export class ConnectorFactory {
  static getPublicConnector(
    connectorGroup: ConnectorGroup,
    connectorConfig: ConnectorConfiguration,
    credential?: Credential
  ): PublicExchangeConnector {
    return new BingXSpotPublicConnector(connectorGroup, connectorConfig, credential);
  }

  static getPrivateConnector(
    connectorGroup: ConnectorGroup,
    connectorConfig: ConnectorConfiguration,
    credential: Credential
  ): PrivateExchangeConnector {
    return new BingXSpotPrivateConnector(connectorGroup, connectorConfig, credential);
  }
}
