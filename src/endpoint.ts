import { ServeExpress } from "./response";

/* FIXME: Solucionar conflicto de nombres en namespaces */
export namespace ServeExpress {
  export namespace Endpoint {
    export enum Methods {
      GET = 1,
      POST,
      PATCH,
      DELETE
    }
    export const stringToMethod: Record<string, Methods> = {
      "GET": Methods.GET,
      "POST": Methods.POST,
      "PATCH": Methods.PATCH,
      "DELETE": Methods.DELETE
    }
    export const middlewareHandler = Methods.DELETE + 1;

    type HandlerLike = Handler | Middleware;
    export type Handler = (req: Request) => ServeExpress.Response;
    export type Middleware = (req: Request, next: HandlerLike) => ServeExpress.Response;

    export interface Binder<T extends HandlerLike, M extends Methods = Methods> {
      path: string;
      handlers: {
        [K in M]: T;
      }
    }

    /* FIXME: Actualizar siguiendo el nuevo Response */
    /// @brief Creates binder and thus its first handler
    export function createBinder<T extends Handler | MidHandler, M extends Methods = Methods>(path: string, method: M, handler: Handler): Binder<T, M> {
      const binderHandlers = {} as any;
      binderHandlers[method] = handler;
      return { path, handlers: binderHandlers } satisfies Binder<T, M>;
    }

    export function addBinderHandler<T extends Handler | MidHandler, M extends Methods = Methods>(binder: Binder<T, M>, method: M, handler: T): Binder<T, M> {
      binder.handlers[method] = handler;
      return binder;
    }
  }
}