export const Logger = {
    getInstance: (debugTag: string) => {
        const logger = {
            log: (...args: any[]) => console.log(debugTag, ...args)
        }
        return logger
    }
}