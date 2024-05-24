"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connector = void 0;
const amqp = require("amqp-connection-manager");
class Connector {
    constructor(log) {
        this.log = log;
    }
    async connect(url, options) {
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
                const error = err;
                reject(err);
                this.log.error(`(rabbitmq): error ${error.message}`, {
                    msg: error.message,
                    name: error.name,
                    stack: error.stack,
                    data: data,
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
exports.Connector = Connector;
//# sourceMappingURL=Connector.js.map