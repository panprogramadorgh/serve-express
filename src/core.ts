import * as http from "node:http";
import { Endpoint } from "endpoint";
import { ResponseWrapper } from "response-wrapper";

export class QuickHTTP {
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

  public listen(port: number, callback?: () => void): void {
    const server = http.createServer((req, res) => {
      for (const binder of this.binders) {
        if (req.url != binder.path)
          continue;

        // Method verification
        const method = req.method != undefined && Endpoint.stringToMethod[req.method as string];
        if (!method || !binder.handlers[method]) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unsopported method" }));
          return;
        }

        // Calls the correspondig handler
        binder.handlers[method](req, new ResponseWrapper(res));
      }
    })
    server.listen(port, callback);
  }
}