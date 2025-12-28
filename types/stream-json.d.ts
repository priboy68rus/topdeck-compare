declare module "stream-json/streamers/StreamArray" {
  import { Readable } from "stream";
  export interface StreamArrayOptions {
    packKeys?: boolean;
  }
  export interface StreamArrayItem<T = any> {
    key: number;
    value: T;
  }
  export interface StreamArrayEmitter<T = any> extends Readable {
    on(event: "data", listener: (item: StreamArrayItem<T>) => void): this;
  }
  export function withParser<T = any>(options?: StreamArrayOptions): StreamArrayEmitter<T>;
}
