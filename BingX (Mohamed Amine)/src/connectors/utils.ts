type ConnectorConfiguration = any;
type ConnectorGroup = any;
type PublicExchangeConnector = any;
type PrivateExchangeConnector = any;
type Serializable = any;
type SklEvent = any;
type Ticker = any;
type TopOfBook = any;
type Trade = any;
type Credential = any;
type BalanceRequest = any;
type BalanceResponse = any;
type BalanceUpdate = any;
type OrderStatusUpdate= any;
class Logger {
    private name: string;
  
    constructor(name: string) {
      this.name = name;
    }
  
    info(message: string): void {
      console.log(`[INFO] [${this.name}] ${message}`);
    }
  
    warn(message: string): void {
      console.warn(`[WARN] [${this.name}] ${message}`);
    }
  
    error(message: string): void {
      console.error(`[ERROR] [${this.name}] ${message}`);
    }
  }

export  {
  ConnectorConfiguration,
  ConnectorGroup,
  PublicExchangeConnector,
  PrivateExchangeConnector,
  Serializable,
  SklEvent,
  Ticker,
  TopOfBook,
  Trade,
  Credential,
  Logger,
  BalanceRequest,
  BalanceResponse,
  OrderStatusUpdate,
  BalanceUpdate
};