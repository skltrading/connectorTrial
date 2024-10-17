enum LogLevel {
    Info = "INFO",
    Warn = "WARN",
    Error = "ERROR",
}

export class Logger {
    private static instances: { [key: string]: Logger } = {}; 
    private loggerType: string; 
    private constructor(loggerType: string) {
        this.loggerType = loggerType;
    }

    public static getInstance(loggerType: string): Logger {
        if (!Logger.instances[loggerType]) {
            Logger.instances[loggerType] = new Logger(loggerType);
        }
        return Logger.instances[loggerType];
    }

    public log(message: string, level: LogLevel = LogLevel.Info): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] [${this.loggerType}] ${message}`);
    }

    public info(message: string): void {
        this.log(message, LogLevel.Info);
    }

    public warn(message: string): void {
        this.log(message, LogLevel.Warn);
    }

    public error(message: string): void {
        this.log(message, LogLevel.Error);
    }
}

