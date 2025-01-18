/// <reference path="./response.ts" />

namespace ServeExpress {
  /* Tipos relacionados con endpoints y middlewares */

  enum HandlerKey {
    get = 1, // Avoids confusions with or and negation operator
    post,
    patch,
    delete,
    any
  }

  type ReqMethods = Omit<typeof HandlerKey, "any">;
  export const ReqMethods: ReqMethods =
  {
    get: HandlerKey.get,
    post: HandlerKey.post,
    patch: HandlerKey.patch,
    delete: HandlerKey.delete
  }
  export type ReqMethod = ReqMethods[keyof ReqMethods];
  export type AnyReqMethod = HandlerKey.any;
  export const AnyReqMethod = HandlerKey.any;

  export type HandlerLike = Handler | Middleware;
  export type Handler = (req: globalThis.Request) => globalThis.Response;
  export type Middleware = (req: globalThis.Request, next: HandlerLike) => globalThis.Response;

  export type Binder<T extends HandlerLike> = T extends Handler ? {
    path: string;
    req_handlers: {
      [K in ReqMethod]: Handler;
    }
  } : {
    path: string;
    mid_handler: Middleware
  }

  /* Rutinas */

  /// @brief Convierte metodos de solicitud en formato string a ReqMethod
  export function string_to_method(stringifyed_method: string): ReqMethod | undefined {
    return (ReqMethods as Record<string, ReqMethod>)[stringifyed_method];
  }
}