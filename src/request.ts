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

  export type HandlerLike = Handler | Middleware;
  export type Handler = (req: globalThis.Request) => ServeExpress.Response;
  export type Middleware = (req: globalThis.Request, next: HandlerLike) => ServeExpress.Response;

  type SelectReqMethod<T extends HandlerLike> = T extends Handler ? ReqMethod : AnyReqMethod;
  export interface Binder<T extends HandlerLike, M extends SelectReqMethod<T> = SelectReqMethod<T>> {
    path: string;
    handlers: {
      [K in M]: T;
    }
  }

  /* Rutinas */

  /// @brief Convierte metodos de solicitud en formato string a ReqMethod
  export function string_to_method(stringifyed_method: string): ReqMethod | undefined {
    return (ReqMethods as Record<string, ReqMethod>)[stringifyed_method];
  }
}