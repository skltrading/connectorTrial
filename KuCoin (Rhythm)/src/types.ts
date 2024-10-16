/**
 * Represents the response from the /api/v1/bullet-public endpoint.
 */
export interface BulletPublicResponse {
  code: string;
  data: {
      instanceServers: InstanceServer[];
      token: string;
  };
}

/**
* Represents an instance server returned by the bullet-public endpoint.
*/
export interface InstanceServer {
  endpoint: string;
  encrypt: boolean;
  protocol: string; // Changed from 'protocols' to 'protocol'
  pingInterval: number;
  pingTimeout: number;
}

/**
* Represents a generic WebSocket message from KuCoin's API.
*/
export interface WebSocketMessage {
  id?: string;
  type: string;
  topic?: string;
  response?: boolean;
  data?: any;
  code?: number;
  // For order book updates
  changes?: {
      asks: [string, string][];
      bids: [string, string][];
  };
  sequenceStart?: number;
  sequenceEnd?: number;
  symbol?: string;
  time?: number;
}

/**
* Configuration object for the KuCoin Private Connector.
*/
export interface KuCoinConfig {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}
