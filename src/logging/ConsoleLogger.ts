import {Logger} from './Logger';

export class ConsoleLogger implements Logger {
    public debug(msg: string, data?: Record<string, unknown>): void {
        if (data) {
            console.debug(msg, data);
        } else {
            console.debug(msg)
        }
    }

    public error(msg: string, data?: Record<string, unknown>): void {
        if (data) {
            console.error(msg, data);
        } else {
            console.error(msg)
        }
    }

    public info(msg: string, data?: Record<string, unknown>): void {
        if (data) {
            console.log(msg, data);
        } else {
            console.log(msg)
        }
    }

    public warn(msg: string, data?: Record<string, unknown>): void {
        if (data) {
            console.warn(msg, data);
        } else {
            console.warn(msg)
        }
    }
}
