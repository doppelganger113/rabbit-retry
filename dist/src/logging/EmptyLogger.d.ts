import { Logger } from './Logger';
/**
 * @description Used for testing only to omit console logs.
 */
export declare class EmptyLogger implements Logger {
    debug(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, data?: Record<string, unknown>): void;
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
}
