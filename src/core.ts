/// <reference path="./response.ts" />
/// <reference path="./request.ts" />

namespace ServeExpress {
  export class Server {
    private binders: ServeExpress.Binder<ServeExpress.HandlerLike>[] = [];

    // TODO: Metodo estatico creacion de binders

    public get(path: string, handler: ServeExpress.Handler): ServeExpress.Binder<ServeExpress.Handler, ServeExpress.ReqMethod> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        return ServeExpress.addBinderHandler<ServeExpress.Handler, ServeExpress.Methods.GET>(binder, ServeExpress.Methods.GET, handler);
      }
      const binder = ServeExpress.createBinder<ServeExpress.Handler, ServeExpress.Methods>(path, ServeExpress.Methods.GET, handler);
      this.binders.push(binder);
      return binder;
    }

    public post(path: string, handler: ServeExpress.Handler): ServeExpress.Binder<ServeExpress.Handler, ServeExpress.Methods.POST> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        return ServeExpress.addBinderHandler<ServeExpress.Handler, ServeExpress.Methods.POST>(binder, ServeExpress.Methods.POST, handler);
      }
      const binder = ServeExpress.createBinder<ServeExpress.Handler, ServeExpress.Methods>(path, ServeExpress.Methods.POST, handler);
      this.binders.push(binder);
      return binder;
    }

    /*
    public use<M extends ServeExpress.Methods = ServeExpress.Methods>(path: string, handler: ServeExpress.MidHandler): ServeExpress.Binder<ServeExpress.Handler, M> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        // TODO: Terminar
        // binder.handlers[ServeExpress.middlewareHandler]
      }
      const binder = ServeExpress.createBinder<ServeExpress.Handler, ServeExpress.Methods>(path, ServeExpress.Methods.POST, handler);
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
            const method = req.method != undefined && ServeExpress.stringToMethod[req.method as string];
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

