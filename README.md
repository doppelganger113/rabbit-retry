# RabbitMQ wrapper

![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/doppelganger113/rabbit-retry/release.yaml)
[![npm version](https://badge.fury.io/js/rabbit-retry.svg)](https://badge.fury.io/js/rabbit-retry)


Library provides publisher and subscriber for RabbitMQ with improved reconnection capabilities that weren't otherwise 
present and multichannel support for both emitting and publishing.

[[_TOC_]]   

## Getting started

```bash
npm install --save-exact rabbit-retry
```

### Usage

The following example shows a consumer and publisher, note that you can have 1 class that is both. It is important
to initialize the connection before being able to use the emitter or subscribe to events.

Note that these are the default options for the queue and the consumer which can be overridden.
```typescript
const QUEUE_OPTIONS_DEFAULT: Options.AssertQueue = {
    durable: true,
};
const CONSUMER_OPTIONS_DEFAULT: Options.Consume = {
    consumerTag: `queue-consumer-${v4()}`,
    noLocal: false,
    exclusive: false,
    noAck: false,
};
```

```typescript
class Job {
    public name: string;
}

class JobsPublisherService {
    public jobsEmitter: Emitter<Job>;

    public constructor(private readonly conn: amqp.AmqpConnectionManager, private readonly log: Logger) {}

    async init() {
        // options are optional
        const options: Options.AssertQueue = {};
        this.jobsEmitter = await RabbitEmitter.createAndConnect(this.conn, this.log, 'jobs', options);
    }

    async shutdown() {
        await this.jobsEmitter.close();
    }
}

class JobsConsumerService {
    public messagesConsumer: Consumer<Job>;
    public consumedJobs: Job[] = [];

    public constructor(private readonly conn: amqp.AmqpConnectionManager, private readonly log: Logger) {}

    async init() {
        // options are optional
        const queueOptions: Options.AssertQueue = {};
        const consumerOptions: Options.Consume = {};
        const channelSetup = async (ch: ConfirmChannel): Promise<void> => {
            await ch.prefetch(1);
        }
        this.messagesConsumer = RabbitConsumer.create(this.conn, this.log, 'jobs', queueOptions, consumerOptions, channelSetup);
        await this.messagesConsumer.subscribe((job) => this.consume(job));
    }

    async shutdown() {
        await this.messagesConsumer.close();
    }

    public async consume(job: Job) {
        this.consumedJobs.push(job);
    }
}

(async () => {
    // You will need to create a Logging class that implements the Logger interface
    // You can use 'console' as the logger for quick setup 
    const rabbitConnection = await new Connector(logger).connect(rabbitUrl);
    const service = new JobsPublisherService(rabbitConnection, logger);
    // 
    await service.init();
    // Produce and/or consume
    await service.jobsEmitter.emit({ name: 'John' });
    // ...
    // Closing the producer/consumer
    await service.shutdown();
})()
```

### Nest.js setup example

Example logging adapter for RabbitMQ:
```typescript
// rabbit-logger.adapter.ts
import {Logger as RabbitLogger} from 'rabbit-retry';
import {Logger} from '@nestjs/common';

export class RabbitLoggerAdapter implements RabbitLogger {

    public constructor(
        private readonly log: Logger
    ) {
    }

    public debug(msg: string, data?: Record<string, any>): void {
        if (data) {
            this.log.debug(data, msg);
        } else {
            this.log.debug(msg);
        }
    }

    public error(msg: string, data?: Record<string, any>): void {
        if (data) {
            this.log.error(data, msg);
        } else {
            this.log.error(msg);
        }
    }

    public info(msg: string, data?: Record<string, any>): void {
        if (data) {
            this.log.log(data, msg);
        } else {
            this.log.log(msg);
        }
    }
    
    public warn(msg: string, data?: Record<string, any>): void {
        if (data) {
            this.log.warn(data, msg);
        } else {
            this.log.warn(msg);
        }
    }
}
```

Create a file `constants.ts` for storing the RabbitMQ connection token constant and avoid circular import.

```typescript
export const RABBITMQ_CONNECTION_TOKEN = 'RABBITMQ_CONNECTION';
```

Create providers in the module `queue.module.ts` to group everything:

```typescript
import { Global, Logger, Module } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { Connector } from 'rabbit-retry';

// Your environment config service
import { EnvConfigService } from '../config/env-config.service';

@Global()
@Module({
    providers: [
        {
            provide: RabbitLoggerAdapter,
            useValue: new RabbitLoggerAdapter(new Logger('RabbitMQ')),
        },
        {
            provide: RABBITMQ_CONNECTION_TOKEN,
            useFactory: async (config: EnvConfigService, logger: RabbitLoggerAdapter): Promise<amqp.AmqpConnectionManager> =>
                new Connector(logger).connect(config.TXN_RABBITMQ_URL, {
                    connectionOptions: {
                        ...(config.TXN_RABBITMQ_KEY &&
                            config.TXN_RABBITMQ_CACERT &&
                            config.TXN_RABBITMQ_CERT && {
                                key: config.TXN_RABBITMQ_KEY,
                                ca: config.TXN_RABBITMQ_CACERT,
                                cert: config.TXN_RABBITMQ_CERT,
                            }),
                    },
                }),
            inject: [EnvConfigService, RabbitLoggerAdapter],
        },
        TestJobsService,
    ],
    exports: [RabbitLoggerAdapter, RABBITMQ_CONNECTION_TOKEN, TestJobsService],
})
export class QueueModule {}
```

Import the module into our main `app.module.ts`
```typescript
@Module({
    imports: [QueueModule],
})
export class AppModule {}
```

Now you can inject the `RABBITMQ_CONNECTION` into your service `TestJobs.service.ts` and bootstrap consumers/providers:
```typescript
@Injectable()
export class TestJobsService implements OnModuleInit, OnModuleDestroy {

    private emitter: Emitter<any>;

    private consumer: RabbitConsumer<any>;

    private log: Logger = new Logger(TestJobsService.name);

    public constructor(
        @Inject(RABBITMQ_CONNECTION_TOKEN)
        private readonly rabbitConnection: amqp.AmqpConnectionManager,
        private readonly rabbitLoggerAdapter: RabbitLoggerAdapter
    ) {
    }

    public async onModuleInit(): Promise<void> {
        this.emitter = await RabbitEmitter.createAndConnect(
            this.rabbitConnection, this.rabbitLoggerAdapter, 'jobs'
        );
        this.consumer = RabbitConsumer.create(this.rabbitConnection, this.rabbitLoggerAdapter, 'jobs');
        await this.consumer.subscribe(async (msg) => this.consume(msg));
    }

    public async onModuleDestroy(): Promise<void> {
        await this.emitter.close();
        await this.consumer.close();
    }

    public async emitJob(data: object): Promise<void> {
        await this.emitter.emit(data)
    }

    public async consume(msg: object): Promise<void> {
        this.log.log('Consumed', msg);
    }

    public isConsumerConnected(): boolean {
        return this.emitter.isConnected();
    }
    
    public isPublisherConnected(): boolean {
        return this.emitter.isConnected();
    }
}
```

Health and readiness checks can be provided by checking against the emitters or consumers connection status.

```typescript
class HealthController {
    @Get('readiness')
    public async checkReadiness(): Promise<HealthCheckResult> {
        return this.health.check([
            async (): Promise<HealthIndicatorResult> => {
                return {
                    '[test](consumer)': {
                        status: this.testService.isConsumerConnected() ? 'up' : 'down'
                    },
                    '[test](publisher)': {
                        status: this.testService.isPublisherConnected() ? 'up' : 'down'
                    }
                }
            }
        ]);
    }
}
```

## Testing

### Integration testing

Due to our CI/CD limitation, tests need to be run manually for `*.e2e-spec.ts` files.

### End-to-end testing

How to test RabbitMQ reconnection? Use Docker and disconnect it from the network while the application is running,
this should prevent producing of events (after retries) and throw error when producing. In any moment you can reconnect
the network and rabbitmq and observe through the application the reconnection, even during the retry phase.

There are example scripts in the `example/` directory which you can run to test the consumer and producer
while performing bellow actions on the rabbitmq docker image and observing behaviour.

  ```bash
  # Get a list of docker networks
  docker network ls
  # Get a list of docker containers
  docker container ls
  # Disconnect the container from the network
  docker network disconnect NETWORK CONTAINER  
  # Connect the container back to the network
  docker network connect NETWORK CONTAINER
  ```

