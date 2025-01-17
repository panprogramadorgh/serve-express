/// <reference path="./response.ts" />

namespace ServeExpress {
  enum BinderHandlerKey {
    get = 1, // Avoids confusions with or and negation operator
    post,
    patch,
    delete,
    any
  }

  type ReqMethods = Omit<typeof BinderHandlerKey, "any">;
  export const ReqMethods: ReqMethods =
  {
    get: BinderHandlerKey.get,
    post: BinderHandlerKey.post,
    patch: BinderHandlerKey.patch,
    delete: BinderHandlerKey.delete
  }
  export type ReqMethod = ReqMethods[keyof ReqMethods];

  const string_to_method: Record<string, ReqMethod> = {
    "get": ReqMethods.get,
    "post": ReqMethods.post,
    "patch": ReqMethods.patch,
    "delete": ReqMethods.delete
  }

  export type HandlerLike = Handler | Middleware;
  export type Handler = (req: globalThis.Request) => ServeExpress.Response;
  export type Middleware = (req: globalThis.Request, next: HandlerLike) => ServeExpress.Response;

  type AppropiatedMethod<T> = T extends Handler ? ReqMethods : typeof any_method;
  export interface Binder<T extends HandlerLike, M extends AppropiatedMethod<T>> {
    path: string;
    handlers: {
      [K in M]: T;
    }
  }

  export class Serve {
    private binders: Endpoint.Binder<Endpoint.Handler | Endpoint.MidHandler>[] = [];

    public get(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.GET> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        return Endpoint.addBinderHandler<Endpoint.Handler, Endpoint.Methods.GET>(binder, Endpoint.Methods.GET, handler);
      }
      const binder = Endpoint.createBinder<Endpoint.Handler, Endpoint.Methods>(path, Endpoint.Methods.GET, handler);
      this.binders.push(binder);
      return binder;
    }

    public post(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.POST> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        return Endpoint.addBinderHandler<Endpoint.Handler, Endpoint.Methods.POST>(binder, Endpoint.Methods.POST, handler);
      }
      const binder = Endpoint.createBinder<Endpoint.Handler, Endpoint.Methods>(path, Endpoint.Methods.POST, handler);
      this.binders.push(binder);
      return binder;
    }

    /*
    public use<M extends Endpoint.Methods = Endpoint.Methods>(path: string, handler: Endpoint.MidHandler): Endpoint.Binder<Endpoint.Handler, M> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        // TODO: Terminar
        // binder.handlers[Endpoint.middlewareHandler]
      }
      const binder = Endpoint.createBinder<Endpoint.Handler, Endpoint.Methods>(path, Endpoint.Methods.POST, handler);
      this.binders.push(binder);
      return binder;
    }
    */

    /* FIXME: Actualizar para el nuevo Response */
    public listen(port: number, callback?: () => void): void {
      const server_binders = this.binders;
      Bun.serve({
        port,
        fetch(req) {
          for (const binder of server_binders) {
            if (req.url != binder.path)
              continue;

            // Method verification
            const method = req.method != undefined && Endpoint.stringToMethod[req.method as string];
            if (!method || !binder.handlers[method]) {
              return new Response(JSON.stringify({ error: "Unsopported method" }), {
                status: 400, headers: {
                  "Content-Type": "application/json"
                }
              });
            }

            // Calls the correspondig handler
            binder.handlers[method](req, new ResponseWrapper(res));
          }

          return new Response();
        }
      });
    }
  }
}

