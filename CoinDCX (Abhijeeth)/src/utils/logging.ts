import CryptoJS from 'crypto-js';

export const generateHmacSignature = (str: string, secret: string): string => {
  return CryptoJS.HmacSHA256(str, secret).toString();
};

export const chunkArray = (array: any[], chunkSize: number): any[][] => {
  const chunks: any[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

export const retry = async (fn: Function, retries: number = 3, delay: number = 1000): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
};




export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    static getInstance(context: string) {
        return new Logger(context);
    }

    log(message: string) {
        console.log(`[${new Date().toISOString()}] [${this.context}] LOG: ${message}`);
    }

    error(message: string, error: unknown) {
        console.error(`[${new Date().toISOString()}] [${this.context}] ERROR: ${message}`);
    }

    warn(message: string) {
        console.warn(`[${new Date().toISOString()}] [${this.context}] WARN: ${message}`);
    }

    info(message: string) {
        console.info(`[${new Date().toISOString()}] [${this.context}] INFO: ${message}`);
    }

    // Add the missing debug method
    debug(message: string): void {
        console.debug(`[${new Date().toISOString()}] [${this.context}] DEBUG: ${message}`);
    }
}

