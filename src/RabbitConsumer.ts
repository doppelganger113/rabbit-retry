import * as amqp from 'amqp-connection-manager';
import { Options } from 'amqplib/properties';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { Logger } from './logging/Logger';
import { v4 } from 'uuid';
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

const QUEUE_OPTIONS_DEFAULT: Options.AssertQueue = {
  durable: true,
};
const CONSUMER_OPTIONS_DEFAULT: Options.Consume = {
  consumerTag: `queue-consumer-${v4()}`,
  noLocal: false,
  exclusive: false,
  noAck: false,
};

export class RabbitConsumer<T extends object> implements Consumer<T> {
  public static create<T extends object>(
    connection: amqp.AmqpConnectionManager,
    log: Logger,
    queueName: string,
    queueOptions?: Options.AssertQueue,
    consumerOptions?: Options.Consume,
    channelSetter?: ChannelSetter,
  ): RabbitConsumer<T> {
    return new RabbitConsumer<T>(connection, log, queueName, queueOptions, consumerOptions, channelSetter);
  }

  private channel: amqp.ChannelWrapper;

  public constructor(
    private readonly connection: amqp.AmqpConnectionManager,
    private readonly log: Logger,
    private readonly queueName: string,
    private readonly queueOptions?: Options.AssertQueue,
    private readonly consumerOptions?: Options.Consume,
    private readonly channelSetter?: ChannelSetter,
  ) {
    this.queueOptions = { ...QUEUE_OPTIONS_DEFAULT, ...(queueOptions || {}) };
    this.consumerOptions = {
      ...CONSUMER_OPTIONS_DEFAULT,
      ...(consumerOptions || {}),
    };
  }

  /**
   * @description Setup performs additional channel assertions/configuration.
   */
  private async setup(channel: ConfirmChannel): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.channelSetter && (await this.channelSetter(channel));
    return Promise.resolve();
  }

  private async registerConsumer(channel: ConfirmChannel, process: Processor<T>): Promise<void> {
    const consume = async (msg: ConsumeMessage): Promise<void> => {
      const parsed: unknown = JSON.parse(msg.content.toString());
      this.log.debug(`[queue-consumer](${this.constructor.name}): consumed '${this.queueName}' message`, {
        event: parsed,
      });
      await process(parsed as T);
    };

    const shouldAck = !this.consumerOptions?.noAck;

    await channel.consume(
      this.queueName,
      (msg: ConsumeMessage) => {
        consume(msg)
          .then(() => {
            if (shouldAck) {
              channel.ack(msg);
            }

            this.log.debug(
              `[queue-consumer](${this.constructor.name}): successfully consumed '${this.queueName}' msg`,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              { event: JSON.parse(msg.content.toString()) },
            );
          })
          .catch((error: unknown) => {
            const err = error as Error;
            this.log.error(
              `[queue-consumer](${this.constructor.name}): failed processing '${
                this.queueName
              }' message ${shouldAck ? ', nacking' : ''}`,
              {
                msg: err.message,
                name: err.name,
                stack: err.stack,
                requeue: String(!msg.fields.redelivered),
              },
            );
            if (shouldAck) {
              try {
                // Will retry once
                channel.nack(msg, undefined, !msg.fields.redelivered);
              } catch (nackError: unknown) {
                const nackErr = nackError as Error;
                this.log.error(
                  `[queue-consumer](${this.constructor.name}): '${this.queueName}' failed nacking message: ${nackErr.message}`,
                  {
                    msg: nackErr.message,
                    name: nackErr.name,
                    stack: nackErr.stack,
                    requeue: String(!msg.fields.redelivered),
                  },
                );
              }
            }
          });
      },
      this.consumerOptions,
    );
  }

  /**
   * @description Register a handler for processing messages once.
   */
  public async subscribe(process: Processor<T>): Promise<void> {
    this.channel = this.connection.createChannel({
      json: true,
      name: this.queueName,
      setup: async (channel: ConfirmChannel) => {
        this.log.info(`[queue-consumer](${this.constructor.name}): asserting queue '${this.queueName}' channel`);
        try {
          await Promise.all([
            channel.assertQueue(this.queueName, this.queueOptions),
            this.setup(channel),
            this.registerConsumer(channel, process),
          ]);
        } catch (error: unknown) {
          const err = error as Error;
          this.log.error(
            `[queue-consumer](${this.constructor.name}): asserting queue '${this.queueName}' channel failed: ${err.message}`,
            {
              msg: err.message,
              name: err.name,
              stack: err.stack,
            },
          );
          throw error;
        }
      },
    });

    this.channel
      .on('connect', () => {
        this.log.info(
          `[queue-consumer](${this.constructor.name}): asserted channel connection to '${this.queueName}' queue`,
        );
      })
      .on('error', (error) => {
        this.log.error(`Queue: channel error for queue '${this.queueName}'`, {
          msg: error.message,
          name: error.name,
          stack: error.stack,
        });
      })
      .on('close', () => {
        this.log.info(`[queue-consumer](${this.constructor.name}): channel closed for queue '${this.queueName}'`);
      });

    await this.channel.waitForConnect();
  }

  public isConnected(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return this.connection.isConnected() && this.channel !== undefined;
  }

  public async close(): Promise<void> {
    return this.channel.close();
  }
}
