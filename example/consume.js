const {Connector, RabbitConsumer, RabbitEmitter} = require('../dist');

const executeEvery = async (timeMs, count, fn) => {
    let counter = 0;
    while (counter < count) {
        await new Promise((resolve) => setTimeout(resolve, timeMs));
        console.log(`[Executing]: ${counter++}`)
        await fn();
    }
}

(async () => {
    // You will need to create a Logging class that implements the Logger interface
    const rabbitConnection = await new Connector(console)
        .connect('amqp://localhost:5672/');

    const messagesConsumer = RabbitConsumer
        .create(rabbitConnection, console, 'consumer_test_jobs');

    await messagesConsumer.subscribe((job) => void console.log('Consumed', job));

    const service = await RabbitEmitter
        .createAndConnect(rabbitConnection, console, 'consumer_test_jobs');

    // Produce and/or consume
    await executeEvery(2_000, 50, async () => {
        try {
            await service.emit({name: 'John'});
        } catch (err) {
            console.error(err);
        }
    })

    // ...
    // Closing the producer/consumer
    await service.close();
    await messagesConsumer.close();
})()
