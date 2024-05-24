import { Logger } from './Logger';
export declare class ConsoleLogger implements Logger {
    debug(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, data?: Record<string, unknown>): void;
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
}
