import * as amqp from 'amqp-connection-manager';
import { Options } from 'amqplib/properties';
import { ConfirmChannel } from 'amqplib';
import { Logger } from './logging/Logger';
import { Consumer } from './Consumer';
/**
 * @description Message handler which is responsible for processing consumed message. Acknowledges the message after
 * the promise resolves.
 */
export type Processor<E> = (msg: E) => Promise<void>;
/**
 * @description Perform channel specific setup like <br>ch.prefetch(1)</br>
 */
export type ChannelSetter = (ch: ConfirmChannel) => Promise<void>;
export declare class RabbitConsumer<T extends object> implements Consumer<T> {
    private readonly connection;
    private readonly log;
    private readonly queueName;
    private readonly queueOptions?;
    private readonly consumerOptions?;
    private readonly channelSetter?;
    static create<T extends object>(connection: amqp.AmqpConnectionManager, log: Logger, queueName: string, queueOptions?: Options.AssertQueue, consumerOptions?: Options.Consume, channelSetter?: ChannelSetter): RabbitConsumer<T>;
    private channel;
    constructor(connection: amqp.AmqpConnectionManager, log: Logger, queueName: string, queueOptions?: Options.AssertQueue | undefined, consumerOptions?: Options.Consume | undefined, channelSetter?: ChannelSetter | undefined);
    /**
     * @description Setup performs additional channel assertions/configuration.
     */
    private setup;
    private registerConsumer;
    /**
     * @description Register a handler for processing messages once.
     */
    subscribe(process: Processor<T>): Promise<void>;
    isConnected(): boolean;
    close(): Promise<void>;
}
