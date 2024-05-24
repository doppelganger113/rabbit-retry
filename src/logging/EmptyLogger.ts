import {Logger} from './Logger';

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * @description Used for testing only to omit console logs.
 */
export class EmptyLogger implements Logger {
    public debug(msg: string, data?: Record<string, unknown>): void {
    }

    public error(msg: string, data?: Record<string, unknown>): void {
    }

    public info(msg: string, data?: Record<string, unknown>): void {
    }

    public warn(msg: string, data?: Record<string, unknown>): void {
    }
}
