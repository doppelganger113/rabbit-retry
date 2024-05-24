import { Options } from 'amqplib/properties';
import * as amqp from 'amqp-connection-manager';
import { Logger } from './logging/Logger';
import { Emitter } from './Emitter';
export interface PublishOptions extends Options.Publish {
    timeoutMs?: number;
    maxRetryNum?: number;
}
export declare class RabbitEmitter<T extends object> implements Emitter<T> {
    private readonly connection;
    private readonly log;
    private readonly queueName;
    private readonly options?;
    static createAndConnect<T extends object>(connection: amqp.AmqpConnectionManager, logger: Logger, queueName: string, options?: Options.AssertQueue): Promise<RabbitEmitter<T>>;
    private channel?;
    private constructor();
    /**
     * @description Setup performs additional channel assertions/configuration.
     */
    private setup;
    establishChannel(): Promise<void>;
    /**
     * @description Send a message to the queue directly. If the connection is broken, it will retry once with
     * a timeout. It's required to first establish a channel connection with {@link establishChannel}.
     */
    emit(msg: T, options?: PublishOptions): Promise<void>;
    isConnected(): boolean;
    close(): Promise<void>;
}
