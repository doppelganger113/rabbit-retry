import { ConnectionUrl } from 'amqp-connection-manager';
import * as amqp from 'amqp-connection-manager';
import { Logger } from './logging/Logger';

export class Connector {
  public constructor(private readonly log: Logger) {}

  public async connect(
    url: ConnectionUrl,
    options?: amqp.AmqpConnectionManagerOptions,
  ): Promise<amqp.AmqpConnectionManager> {
    const rabbitConnection = amqp.connect(url, options);

    return new Promise((resolve, reject) => {
      rabbitConnection
        .on('connect', () => {
          resolve(rabbitConnection);
          this.log.info('(rabbitmq): connected');
        })
        .on('disconnect', () => {
          this.log.info('(rabbitmq): disconnected');
        })
        .on('error', ({ err }, data) => {
          const error = err as Error;
          reject(err);
          this.log.error(`(rabbitmq): error ${error.message}`, {
            msg: error.message,
            name: error.name,
            stack: error.stack,
            data: data as object,
          });
        })
        .on('connectFailed', (err) => {
          this.log.error('(rabbitmq): connectFailed', err);
          reject(err);
        })
        .on('blocked', ({ reason }) => {
          reject(new Error(`Blocked: ${reason}`));
          this.log.warn('(rabbitmq): blocked connection', { reason });
        })
        .on('unblocked', () => {
          this.log.info('(rabbitmq): unblocked');
        });
    });
  }
}

