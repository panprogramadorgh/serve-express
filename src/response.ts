import { TransformStream, WritableStream, ReadableStream } from "stream/web";

namespace ServeExpress {
  export class Response {
    private status_code: number;
    private headers: Record<string, string> = {};

    /* TODO: Terminar implementar */
    private res_writable: WritableStream<string>;
    private res_readable: ReadableStream<string>;

    constructor(status_code_initializer: number) {
      if (status_code_initializer >= 600)
        throw new Error("Status code must be under 600");
      const transform_stream = new TransformStream<string, string>();
      this.res_writable = transform_stream.writable;
      this.res_readable = transform_stream.readable;
      this.status_code = status_code_initializer;
    }

    public getStatusCode(): number {
      return this.status_code;
    }
    public setStatusCode(new_value: number): number | never {
      if (new_value >= 600)
        throw new Error("Status code must be under 600");
      return this.status_code = new_value;
    }

    public getHeader(name: string): string | never {
      const value = this.headers[name];
      if (!value)
        throw new Error("Cannot get undefined header");
      return value;
    }

    public addHeader(name: string, value: string): void {
      this.headers[name] = value;
    }

    public remHeader(name: string): string | never {
      const value = this.headers[name] as string | undefined;
      if (!value)
        throw new Error("Cannot remove undefined header");
      delete this.headers[name];
      return value; // Returns the old header value
    }

    public send(message: string): globalThis.Response {
      const default_content_type = "text/plain";
      if (!this.headers["Content-Type"]) {
        this.headers['Content-Type'] = default_content_type;
      }
      return new globalThis.Response(message, { status: this.status_code, headers: this.headers })
    }

    public json(data: any): globalThis.Response {
      const json_message = JSON.stringify(data);
      const defualt_content_type = "application/json";
      if (!this.headers["Content-Type"]) {
        this.headers["Content-Type"] = defualt_content_type;
      }
      return new globalThis.Response(json_message, { status: this.status_code, headers: this.headers });
    }
  }
}

