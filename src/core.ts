/// <reference path="./response.ts" />
/// <reference path="./request.ts" />

namespace ServeExpress {
  export class Server {
    private binders: ServeExpress.Binder<ServeExpress.HandlerLike>[] = [];

    // TODO: Metodo estatico creacion de binders
    private static bind<T extends ServeExpress.HandlerLike>(options: ((T extends ServeExpress.Handler ? {
      method: ServeExpress.ReqMethod;
    } : {
      method: ServeExpress.AnyReqMethod;
    }) & {
      binders_arr: ServeExpress.Binder<ServeExpress.HandlerLike>[],
      path: string,
      res_generator: globalThis.Response | T;
    })): ServeExpress.Binder<T> {
      let binder_index = -1;
      for (const each_binder_index in options.binders_arr) {
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

      if (binder_index <= 1) {
        // TODO: Crear binder dentro de binders_arr y definir primer handler para binder en req_handlers
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

