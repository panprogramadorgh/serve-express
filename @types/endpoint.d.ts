import * as http from "node:http";
import { ResponseWrapper } from "./response-wrapper";
export declare namespace Endpoint {
    enum Methods {
        GET = 1,
        POST = 2,
        PATCH = 3,
        DELETE = 4
    }
    const stringToMethod: Record<string, Methods>;
    const middlewareHandler: number;
    type Handler = (req: http.IncomingMessage, res: ResponseWrapper) => ResponseWrapper;
    type MidHandler = (req: http.IncomingMessage, res: ResponseWrapper, next?: MidHandler) => ResponseWrapper;
    interface Binder<T extends Handler | MidHandler, M extends Methods = Methods> {
        path: string;
        handlers: {
            [K in M]: T;
        };
    }
    function createBinder<T extends Handler | MidHandler, M extends Methods = Methods>(path: string, method: M, handler: Handler): Binder<T, M>;
    function addBinderHandler<T extends Handler | MidHandler, M extends Methods = Methods>(binder: Binder<T, M>, method: M, handler: T): Binder<T, M>;
}
