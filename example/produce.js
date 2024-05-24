const {Connector, RabbitEmitter} = require('../dist');

const executeEvery = async (timeMs, count, fn) => {
    let counter = 0;
    while (counter < count) {
        await new Promise((resolve) => setTimeout(resolve, timeMs));
        console.log(`[Executing]: ${counter++}`)
        await fn();
    }
}

class JobsPublisherService {
    jobsEmitter;

    constructor(conn, log) {
        this.conn = conn;
        this.log = log;
    }

    async init() {
        this.jobsEmitter = await RabbitEmitter.createAndConnect(this.conn, this.log, 'jobs');
    }

    async shutdown() {
        await this.jobsEmitter.close();
    }
}

// Produces message every 2 seconds
// Manual stopping of rabbit container or disconnecting/connecting the network is used for testing retrying
(async () => {
    const rabbitConnection = await new Connector(console)
        .connect('amqp://localhost:5672/');

    const service = new JobsPublisherService(rabbitConnection, console);
    await service.init();

    await executeEvery(2_000, 50, async () => {
        try {
            await service.jobsEmitter.emit({name: 'John'});
        } catch (err) {
            console.error(err);
        }
    })

    // Closing the producer/consumer
    await service.shutdown();
})();