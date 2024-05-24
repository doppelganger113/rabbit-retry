"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitConsumer = void 0;
const uuid_1 = require("uuid");
const QUEUE_OPTIONS_DEFAULT = {
    durable: true,
};
const CONSUMER_OPTIONS_DEFAULT = {
    consumerTag: `queue-consumer-${(0, uuid_1.v4)()}`,
    noLocal: false,
    exclusive: false,
    noAck: false,
};
class RabbitConsumer {
    static create(connection, log, queueName, queueOptions, consumerOptions, channelSetter) {
        return new RabbitConsumer(connection, log, queueName, queueOptions, consumerOptions, channelSetter);
    }
    constructor(connection, log, queueName, queueOptions, consumerOptions, channelSetter) {
        this.connection = connection;
        this.log = log;
        this.queueName = queueName;
        this.queueOptions = queueOptions;
        this.consumerOptions = consumerOptions;
        this.channelSetter = channelSetter;
        this.queueOptions = { ...QUEUE_OPTIONS_DEFAULT, ...(queueOptions || {}) };
        this.consumerOptions = {
            ...CONSUMER_OPTIONS_DEFAULT,
            ...(consumerOptions || {}),
        };
    }
    /**
     * @description Setup performs additional channel assertions/configuration.
     */
    async setup(channel) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.channelSetter && (await this.channelSetter(channel));
        return Promise.resolve();
    }
    async registerConsumer(channel, process) {
        const consume = async (msg) => {
            const parsed = JSON.parse(msg.content.toString());
            this.log.debug(`[queue-consumer](${this.constructor.name}): consumed '${this.queueName}' message`, {
                event: parsed,
            });
            await process(parsed);
        };
        const shouldAck = !this.consumerOptions?.noAck;
        await channel.consume(this.queueName, (msg) => {
            consume(msg)
                .then(() => {
                if (shouldAck) {
                    channel.ack(msg);
                }
                this.log.debug(`[queue-consumer](${this.constructor.name}): successfully consumed '${this.queueName}' msg`, 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { event: JSON.parse(msg.content.toString()) });
            })
                .catch((error) => {
                const err = error;
                this.log.error(`[queue-consumer](${this.constructor.name}): failed processing '${this.queueName}' message ${shouldAck ? ', nacking' : ''}`, {
                    msg: err.message,
                    name: err.name,
                    stack: err.stack,
                    requeue: String(!msg.fields.redelivered),
                });
                if (shouldAck) {
                    try {
                        // Will retry once
                        channel.nack(msg, undefined, !msg.fields.redelivered);
                    }
                    catch (nackError) {
                        const nackErr = nackError;
                        this.log.error(`[queue-consumer](${this.constructor.name}): '${this.queueName}' failed nacking message: ${nackErr.message}`, {
                            msg: nackErr.message,
                            name: nackErr.name,
                            stack: nackErr.stack,
                            requeue: String(!msg.fields.redelivered),
                        });
                    }
                }
            });
        }, this.consumerOptions);
    }
    /**
     * @description Register a handler for processing messages once.
     */
    async subscribe(process) {
        this.channel = this.connection.createChannel({
            json: true,
            name: this.queueName,
            setup: async (channel) => {
                this.log.info(`[queue-consumer](${this.constructor.name}): asserting queue '${this.queueName}' channel`);
                try {
                    await Promise.all([
                        channel.assertQueue(this.queueName, this.queueOptions),
                        this.setup(channel),
                        this.registerConsumer(channel, process),
                    ]);
                }
                catch (error) {
                    const err = error;
                    this.log.error(`[queue-consumer](${this.constructor.name}): asserting queue '${this.queueName}' channel failed: ${err.message}`, {
                        msg: err.message,
                        name: err.name,
                        stack: err.stack,
                    });
                    throw error;
                }
            },
        });
        this.channel
            .on('connect', () => {
            this.log.info(`[queue-consumer](${this.constructor.name}): asserted channel connection to '${this.queueName}' queue`);
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
    isConnected() {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return this.connection.isConnected() && this.channel !== undefined;
    }
    async close() {
        return this.channel.close();
    }
}
exports.RabbitConsumer = RabbitConsumer;
//# sourceMappingURL=RabbitConsumer.js.map