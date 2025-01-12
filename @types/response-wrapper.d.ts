import * as http from "node:http";
type HandlerResObj = http.ServerResponse & {
    req: http.IncomingMessage;
};
export declare class ResponseWrapper {
    response: HandlerResObj;
    constructor(response: HandlerResObj);
    contentType(ct: string): void;
    status(code: number): ResponseWrapper;
    json(data: any): ResponseWrapper;
}
export {};
