import { ConnectionUrl } from 'amqp-connection-manager';
import * as amqp from 'amqp-connection-manager';
import { Logger } from './logging/Logger';
export declare class Connector {
    private readonly log;
    constructor(log: Logger);
    connect(url: ConnectionUrl, options?: amqp.AmqpConnectionManagerOptions): Promise<amqp.AmqpConnectionManager>;
}
