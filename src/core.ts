/// <reference path="./response.ts" />
/// <reference path="./request.ts" />

namespace ServeExpress {
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
    req_handlers: {
      [K in ReqMethod]: globalThis.Response | Handler;
    }
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

  /// @brief Convierte metodos de solicitud en formato string a ReqMethod
  function string_to_method(stringifyed_method: string): ReqMethod | undefined {
    return (ReqMethods as Record<string, ReqMethod>)[stringifyed_method];
  }

  export class Server {
    private binders: Binder<HandlerLike>[] = [];

    // TODO: Metodo estatico creacion de binders
    private static bind<T extends HandlerLike>(options: BindOptions<T>): Binder<T> {
      let binder_index = -1;
      for (let each_binder_index = 0; each_binder_index < options.binders_arr.length; each_binder_index++) {
        if (options.binders_arr[each_binder_index].path == options.path) {
          binder_index = each_binder_index;
          break;
        }
      }

      /*
       TODO:
       
       El handler (res_generator) debe escribirse en el objeto de acuerdo con el correspondiente tipo de T, por lo tanto debemos hacer una verificacion de tipos en tiempo de ejecucion.

       El metodo debe retornar ademas el nuevo binder creado
      */

      if (options.method == AnyReqMethod) {
        options.binders_arr[binder_index] =
        {
          path: options.path,
          mid_handler: options.res_generator
        }
      } else if (binder_index == -1) {
        //  FIXME: Object.fromEntries convierte las claves en string, por lo tanto no son ReqMethod

        options.binders_arr[binder_index] =
        {
          path: options.path,
          req_handlers: Object.fromEntries(Object.values(ReqMethods).map((method) => {
            return [method, undefined];
          }))
        }
      } else { // binder_index > -1 && Object.values(ReqMethods).includes(options.method)

      }

      // TODO: Definir handler para binder existente
    }

    /*
      TODO:
      
      Implementar el resto de metodos
    */
    public get(path: string, handler: ServeExpress.Handler): ServeExpress.Binder<ServeExpress.Handler> {
      return Server.bind({
        binders_arr: this.binders,
        method: ServeExpress.ReqMethods.get,
        path,
        res_generator: handler
      })
    }

    public post(path: string, handler: ServeExpress.Handler): ServeExpress.Binder<ServeExpress.Handler> {
      return Server.bind({
        binders_arr: this.binders,
        method: ServeExpress.ReqMethods.post,
        path,
        res_generator: handler
      })
    }

    public use(path: string, handler: ServeExpress.Middleware): ServeExpress.Binder<ServeExpress.Middleware> {
      return Server.bind({
        binders_arr: this.binders,
        method: ServeExpress.AnyReqMethod,
        path,
        res_generator: handler
      })
    }

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
            const method = req.method != undefined && ServeExpress.string_to_method(req.method);

            if ((binder as any)["req_handlers"]) {
              let handler = binder.req_handlers[method];
              if (!method || !handler) {
                return new Response(JSON.stringify({ error: "Unsopported method" }), {
                  status: 400, headers: {
                    "Content-Type": "application/json"
                  }
                });
              }
              return handler(req);
            }

            return binder.mid_handler(req);
          }

          return new Response();
        }
      });

      callback ? callback() : undefined;
    }
  }
}

