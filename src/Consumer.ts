import { Processor } from './RabbitConsumer';

export interface Consumer<T> {
  subscribe(processor: Processor<T>): Promise<void>;

  isConnected(): boolean;

  close(): Promise<void>;
}
