export interface Emitter<T extends object> {
  emit(msg: T): Promise<void>;

  isConnected(): boolean;

  close(): Promise<void>;
}
