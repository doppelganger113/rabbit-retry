import { Options } from 'amqplib/properties';
import * as amqp from 'amqp-connection-manager';
import { Logger } from './logging/Logger';
import { ConfirmChannel } from 'amqplib';
import { sleep } from './utility/promise';
import { Emitter } from './Emitter';

const PUBLISH_TIMEOUT_DEFAULT = 2_000;
const PUBLISH_TIMEOUT_MAX_RETRY_NUM = 5;

export interface PublishOptions extends Options.Publish {
  timeoutMs?: number;
  maxRetryNum?: number;
}

export class RabbitEmitter<T extends object> implements Emitter<T> {
  public static async createAndConnect<T extends object>(
    connection: amqp.AmqpConnectionManager,
    logger: Logger,
    queueName: string,
    options?: Options.AssertQueue,
  ): Promise<RabbitEmitter<T>> {
    const pub = new RabbitEmitter<T>(connection, logger, queueName, options);
    await pub.establishChannel();
    return pub;
  }

  private channel?: amqp.ChannelWrapper;

  private constructor(
    private readonly connection: amqp.AmqpConnectionManager,
    private readonly log: Logger,
    private readonly queueName: string,
    private readonly options?: Options.AssertQueue,
  ) {}

  /**
   * @description Setup performs additional channel assertions/configuration.
   */
  private async setup(_channel: ConfirmChannel): Promise<void> {
    return Promise.resolve();
  }

  public async establishChannel(): Promise<void> {
    // Safety so channel establishment is done only once
    if (this.channel) {
      return;
    }
    this.channel = this.connection.createChannel({
      json: true,
      name: this.queueName,
      setup: async (channel: ConfirmChannel) => {
        this.log.info(`[queue-publisher](${this.constructor.name}): asserting queue '${this.queueName}' channel`);
        try {
          await Promise.all([channel.assertQueue(this.queueName, this.options), this.setup(channel)]);
        } catch (error: unknown) {
          const err = error as Error;
          this.log.error(
            `[queue-publisher](${this.constructor.name}): asserting queue '${this.queueName}' channel failed: ${err.message}`,
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
          `[queue-publisher](${this.constructor.name}): asserted channel connection to '${this.queueName}' queue`,
        );
      })
      .on('error', (error) => {
        this.log.error(`[queue-publisher](${this.constructor.name}): channel error for queue '${this.queueName}'`, {
          msg: error.message,
          name: error.name,
          stack: error.stack,
        });
      })
      .on('close', () => {
        this.log.info(`[queue-publisher](${this.constructor.name}): channel closed for queue '${this.queueName}'`);
      });

    await this.channel.waitForConnect();
  }

  /**
   * @description Send a message to the queue directly. If the connection is broken, it will retry once with
   * a timeout. It's required to first establish a channel connection with {@link establishChannel}.
   */
  public async emit(msg: T, options?: PublishOptions): Promise<void> {
    if (!this.channel) {
      throw new Error(
        `No channel established, unable to send! Check publisher ${this.constructor.name} channel establishment.`,
      );
    }

    if (this.connection.isConnected()) {
      this.log.debug(`[queue-publisher](${this.constructor.name}): publishing message to '${this.queueName}'`, {
        event: msg,
        options,
        isConnected: this.connection.isConnected(),
      });
      await this.channel.sendToQueue(this.queueName, msg, options as Options.Publish);
      return;
    }

    let retryCount = 0;
    const maxRetryCount = (options && options.maxRetryNum) || PUBLISH_TIMEOUT_MAX_RETRY_NUM;
    const timeout = (options && options.timeoutMs) || PUBLISH_TIMEOUT_DEFAULT;

    this.log.info('[queue-publisher](${this.constructor.name}): connection is closed, retrying to publish...', {
      retryCount,
      maxRetryCount,
      timeout,
    });

    while (!this.connection.isConnected() && retryCount < maxRetryCount) {
      retryCount += 1;
      await sleep(timeout);
    }
    if (!this.connection.isConnected()) {
      throw new Error(
        `[queue-publisher](${this.constructor.name}): publishing message to queue '${this.queueName}' timed out after ${
          (retryCount + 1) * timeout
        }Millis`,
      );
    }

    this.log.debug(`[queue-publisher](${this.constructor.name}): publishing message to '${this.queueName}'`, {
      event: msg,
      options,
      isConnected: this.connection.isConnected(),
    });
    await this.channel.sendToQueue(this.queueName, msg, options as Options.Publish);
  }

  public isConnected(): boolean {
    return this.connection.isConnected() && this.channel !== undefined;
  }

  public async close(): Promise<void> {
    await this.channel?.close();
  }
}
