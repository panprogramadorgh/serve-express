declare module "quickhttp"
{
  export * from "core"
  export * from "endpoint"
  export * from "response-wrapper"
}

// import http from "node:http";

// declare module "quickhttp" {
//   export type HandlerResObj = http.ServerResponse & { req: http.IncomingMessage; };

//   export class ResponseWrapper {
//     constructor(public response: HandlerResObj);

//     /// @brief Sets the Content-Type header
//     /// @todo Opto to a more generic aproach (likely setHeaders())
//     public contentType(ct: string): void;

//     /// @brief Sets status code for response
//     public status(code: number): ResponseWrapper;

//     /// @brief Sends data in json format
//     public json(data: any): ResponseWrapper;
//   }

//   export namespace Endpoint {
//     export enum Methods {
//       GET = 1,
//       POST,
//       PATCH,
//       DELETE
//     }

//     export const stringToMethod: Record<string, Methods>;

//     export const middlewareHandler = Methods.DELETE + 1;

//     export type Handler = (req: http.IncomingMessage, res: ResponseWrapper) => ResponseWrapper;
//     export type MidHandler = (req: http.IncomingMessage, res: ResponseWrapper, next?: MidHandler) => ResponseWrapper;

//     export interface Binder<T extends Handler | MidHandler, M extends Methods = Methods> {
//       path: string;
//       handlers: {
//         [K in M]: T;
//       }
//     }

//     /// @brief Creates binder and thus its first handler
//     export function createBinder<T extends Handler | MidHandler, M extends Methods = Methods>(path: string, method: M, handler: Handler): Binder<T, M>;

//     export function addBinderHandler<T extends Handler | MidHandler, M extends Methods = Methods>(binder: Binder<T, M>, method: M, handler: T): Binder<T, M>;
//   }


//   export class QuickHTTP {
//     private binders: Endpoint.Binder<Endpoint.Handler | Endpoint.MidHandler>[];

//     public get(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.GET>;

//     public post(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.POST>;

//     public listen(port: number, callback?: () => void): void;
//   }
// }