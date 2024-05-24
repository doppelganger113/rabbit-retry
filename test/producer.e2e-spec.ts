import { GenericContainer, Network, StartedNetwork, StartedTestContainer } from 'testcontainers';
import { Connector, EmptyLogger, Logger, Emitter, RabbitConsumer, RabbitEmitter, Consumer } from '..';
import { sleep } from '../src/utility/promise';
import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

class Job {
  public name: string;
}

class JobsPublisherService {
  public jobsEmitter: Emitter<Job>;

  public constructor(
    private readonly conn: amqp.AmqpConnectionManager,
    private readonly log: Logger,
  ) {}

  public async init(): Promise<void> {
    this.jobsEmitter = await RabbitEmitter.createAndConnect(this.conn, this.log, 'jobs');
  }

  public async shutdown(): Promise<void> {
    await this.jobsEmitter.close();
  }
}

class JobsConsumerService {
  public messagesConsumer: Consumer<Job>;

  public consumedJobs: Job[] = [];

  public constructor(
    private readonly conn: amqp.AmqpConnectionManager,
    private readonly log: Logger,
  ) {}

  public async init(): Promise<void> {
    const setupChannel = async (ch: ConfirmChannel): Promise<void> => {
      await ch.prefetch(1);
    };

    this.messagesConsumer = RabbitConsumer.create(this.conn, this.log, 'jobs', undefined, undefined, setupChannel);
    await this.messagesConsumer.subscribe(async (job) => this.consume(job));
  }

  public async shutdown(): Promise<void> {
    await this.messagesConsumer.close();
  }

  public async consume(job: Job): Promise<void> {
    this.consumedJobs.push(job);
    return Promise.resolve();
  }
}

describe('producer', () => {
  let network: StartedNetwork;
  let container: StartedTestContainer;
  let rabbitUrl: string;
  const logger = new EmptyLogger();

  jest.setTimeout(60000);

  beforeAll(async () => {
    network = await new Network().start();
    container = await new GenericContainer('rabbitmq:management')
      .withExposedPorts(5672)
      .withNetworkMode(network.getName())
      .start();

    rabbitUrl = `amqp://${container.getHost()}:${container.getMappedPort(5672)}`;
  });

  afterAll(async () => {
    await container.stop();
    await network.stop();
  });

  it('should publish messages to RabbitMQ without consumer', async () => {
    const rabbitConnection = await new Connector(logger).connect(rabbitUrl);
    const service = new JobsPublisherService(rabbitConnection, logger);
    await service.init();
    expect(service.jobsEmitter.isConnected()).toBe(true);
    await service.jobsEmitter.emit({ name: 'John' });
    await service.jobsEmitter.emit({ name: 'Nicholas' });
    await service.shutdown();
    await rabbitConnection.close();
  });

  it('should consume messages from RabbitMQ previously published', async () => {
    const rabbitConnection = await new Connector(logger).connect(rabbitUrl);
    const service = new JobsConsumerService(rabbitConnection, logger);

    await service.init();
    expect(service.messagesConsumer.isConnected()).toBe(true);
    await sleep(1_000);
    expect(service.consumedJobs).toEqual([{ name: 'John' }, { name: 'Nicholas' }]);
    await service.shutdown();
    await rabbitConnection.close();
  });
});
