"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitEmitter = void 0;
const promise_1 = require("./utility/promise");
const PUBLISH_TIMEOUT_DEFAULT = 2_000;
const PUBLISH_TIMEOUT_MAX_RETRY_NUM = 5;
class RabbitEmitter {
    static async createAndConnect(connection, logger, queueName, options) {
        const pub = new RabbitEmitter(connection, logger, queueName, options);
        await pub.establishChannel();
        return pub;
    }
    constructor(connection, log, queueName, options) {
        this.connection = connection;
        this.log = log;
        this.queueName = queueName;
        this.options = options;
    }
    /**
     * @description Setup performs additional channel assertions/configuration.
     */
    async setup(_channel) {
        return Promise.resolve();
    }
    async establishChannel() {
        // Safety so channel establishment is done only once
        if (this.channel) {
            return;
        }
        this.channel = this.connection.createChannel({
            json: true,
            name: this.queueName,
            setup: async (channel) => {
                this.log.info(`[queue-publisher](${this.constructor.name}): asserting queue '${this.queueName}' channel`);
                try {
                    await Promise.all([channel.assertQueue(this.queueName, this.options), this.setup(channel)]);
                }
                catch (error) {
                    const err = error;
                    this.log.error(`[queue-publisher](${this.constructor.name}): asserting queue '${this.queueName}' channel failed: ${err.message}`, {
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
            this.log.info(`[queue-publisher](${this.constructor.name}): asserted channel connection to '${this.queueName}' queue`);
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
    async emit(msg, options) {
        if (!this.channel) {
            throw new Error(`No channel established, unable to send! Check publisher ${this.constructor.name} channel establishment.`);
        }
        if (this.connection.isConnected()) {
            this.log.debug(`[queue-publisher](${this.constructor.name}): publishing message to '${this.queueName}'`, {
                event: msg,
                options,
                isConnected: this.connection.isConnected(),
            });
            await this.channel.sendToQueue(this.queueName, msg, options);
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
            await (0, promise_1.sleep)(timeout);
        }
        if (!this.connection.isConnected()) {
            throw new Error(`[queue-publisher](${this.constructor.name}): publishing message to queue '${this.queueName}' timed out after ${(retryCount + 1) * timeout}Millis`);
        }
        this.log.debug(`[queue-publisher](${this.constructor.name}): publishing message to '${this.queueName}'`, {
            event: msg,
            options,
            isConnected: this.connection.isConnected(),
        });
        await this.channel.sendToQueue(this.queueName, msg, options);
    }
    isConnected() {
        return this.connection.isConnected() && this.channel !== undefined;
    }
    async close() {
        await this.channel?.close();
    }
}
exports.RabbitEmitter = RabbitEmitter;
//# sourceMappingURL=RabbitEmitter.js.map