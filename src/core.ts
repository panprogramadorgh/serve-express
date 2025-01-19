/// <reference path="./response.ts" />

import { BinaryToTextEncoding } from "crypto";

export namespace ServeExpress {
  /* Endpoint and middleware related types */

  enum HandlerKey {
    get = 1, // Avoids confusions with or and negation operator
    post,
    patch,
    delete,
    any
  }
  type ReqMethods = Omit<typeof HandlerKey, "any">;
  const ReqMethods: ReqMethods =
  {
    get: HandlerKey.get,
    post: HandlerKey.post,
    patch: HandlerKey.patch,
    delete: HandlerKey.delete
  }
  type ReqMethod = ReqMethods[keyof ReqMethods];
  type AnyReqMethod = HandlerKey.any;
  const AnyReqMethod = HandlerKey.any;

  type HandlerLike = Handler | Middleware;
  type Handler = (req: globalThis.Request) => globalThis.Response;
  type Middleware = (req: globalThis.Request, next: HandlerLike) => globalThis.Response;

  type Binder<T extends HandlerLike> = T extends Handler ? {
    path: string;
    req_handlers: Record<ReqMethod, globalThis.Response | Handler>
  } : {
    path: string;
    mid_handler: globalThis.Response | Middleware
  }

  type BindOptions<T extends HandlerLike> =
    (T extends Handler ? {
      method: ReqMethod;
    } : {
      method: AnyReqMethod;
    }) & {
      binders_arr: Binder<HandlerLike>[],
      path: string,
      res_generator: globalThis.Response | T;
    }

  /* Rutinas */

  /// @brief Inicializa todos handlers de un binder con una respuesta estandar
  function init_req_handlers(): Record<ReqMethod, globalThis.Response> {
    const unsupported = Response.json({ error: "Unsupported method" }, { status: 400 });
    return {
      [ReqMethods.get]: unsupported,
      [ReqMethods.post]: unsupported,
      [ReqMethods.patch]: unsupported,
      [ReqMethods.delete]: unsupported,
    }
  }

  /// @brief Convierte metodos de solicitud en formato string a ReqMethod
  function string_to_method(stringifyed_method: string): ReqMethod | undefined {
    return (ReqMethods as Record<string, ReqMethod>)[stringifyed_method];
  }

  export class Server {
    private binders: Binder<HandlerLike>[] = [];

    /*
      Add the following constraint to bind method:

        1. Cannot bind a middleware whose path isn't associated with a handler-binder
        2. Cannot have two or more handler-binders associated with the same path, instead we should only be able to override binder-handler method handlers functions if exists (however multiple middlewares may be binded atop the same path)
    */
    private static bind<T extends HandlerLike>(options: BindOptions<T>): Binder<T> | never {
      let binder_index = -1;
      for (let each_binder_index = 0; each_binder_index < options.binders_arr.length; each_binder_index++) {
        if (options.binders_arr[each_binder_index].path == options.path) {
          binder_index = each_binder_index;
          break;
        }
      }

      if (options.method == AnyReqMethod && binder_index == -1) {
        throw new Error("Cannot bind a middleware whose path isn't associated with a handler binder")
      }

      // Configures res_generator based on run time checkings
      if (options.method == AnyReqMethod) {
        options.binders_arr.push({
          path: options.path,
          mid_handler: options.res_generator
        });

        binder_index = options.binders_arr.length - 1;
      } else if (binder_index == -1) { // Creates the handler-binder cos doesn't exists
        options.binders_arr.push({
          path: options.path,
          req_handlers: init_req_handlers()
        });
        (options.binders_arr[options.binders_arr.length - 1] as Binder<Handler>).req_handlers[options.method] = options.res_generator as Response | Handler;

        binder_index = options.binders_arr.length - 1;
      } else { // binder_index >= 0 && Object.values(ReqMethods).includes(options.method)
        (options.binders_arr[binder_index] as Binder<Handler>).req_handlers[options.method] = options.res_generator as Response | Handler;
      }

      return options.binders_arr[binder_index] as Binder<T>;
    }

    /// @brief Supports static responses system (built atop bun's static responses)
    public get(path: string, handler: globalThis.Response | Handler): Binder<Handler> {
      return Server.bind({
        binders_arr: this.binders,
        method: ReqMethods.get,
        path,
        res_generator: handler
      })
    }

    /// @brief Supports static responses system (built atop bun's static responses)
    public post(path: string, handler: globalThis.Response | Handler): Binder<Handler> {
      return Server.bind({
        binders_arr: this.binders,
        method: ReqMethods.post,
        path,
        res_generator: handler
      })
    }

    /// @brief Supports static responses system (built atop bun's static responses)
    public patch(path: string, handler: globalThis.Response | Handler): Binder<Handler> {
      return Server.bind({
        binders_arr: this.binders,
        method: ReqMethods.patch,
        path,
        res_generator: handler
      })
    }

    // TODO: Finish implementation of remaining methods

    /* FIXME: Actualizar para el nuevo Response */
    public listen(port: number, callback?: () => void): void {
      const server_binders = this.binders;
      Bun.serve({
        port,
        fetch(req) {
          for (const binder of server_binders) {
            if (req.url != binder.path)
              continue;

            /* Method verification is important since it could be unrecognized or not supported */
            const method = string_to_method(req.method);
            if (!method) {
              return Response.json({ error: "Unrecognized method" }, { status: 400 })
            }

            // TODO: Ejecutar middlewares precedentes al Binder<Handler>

            // Type guard for Binder<Handler>
            if ((binder as Binder<Handler>).req_handlers) {
              const res_generator = (binder as Binder<Handler>).req_handlers[method];
              if (typeof res_generator == "function") {
                return res_generator(req);
              }
              return res_generator; // Static response
            }

            // Binder<Middleware>
            const res_generator = (binder as Binder<Middleware>).mid_handler;
            if (typeof res_generator == "function") {
              return res_generator(req);
            }
            return res_generator; // Static response
          }

          return new Response();
        }
      });

      callback ? callback() : undefined;
    }
  }
}

