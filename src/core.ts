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

type Handler = (req: Request) => Response;
/* El middleware puede ceder la ejecucion al resto de midleware (midleware estandar o middleware de errores). De lo contrario retornara una respuseta.  */
type Middleware<T extends "step" | "res"> = (req: Request, next: MiddlewareCb<T>) => T extends "res" ? Response : void;
export type MiddlewareCb<T extends "step" | "res"> = (error: T extends "res" ? false : boolean) => void

type MiddlewareLike = Middleware<"step"> | Middleware<"res">;
type HandlerLike = Handler | MiddlewareLike;

type Binder<T extends HandlerLike> = T extends Handler ? {
  path: string;
  req_handlers: Record<ReqMethod, Response | Handler>
} : {
  path: string;
  mid_handler: Response | MiddlewareLike
}

type BindOptions<T extends HandlerLike> =
  (T extends Handler ? {
    method: ReqMethod;
  } : {
    method: AnyReqMethod;
  }) & {
    binders_arr: Binder<HandlerLike>[],
    path: string,
    res_generator: Response | T;
  }

/* Rutinas */

/* Predicates for easying narrowing */
function is_handler_binder<T extends Binder<HandlerLike>>(binder: T): binder is Extract<T, Binder<Handler>> {
  return typeof (binder as Extract<T, Binder<Handler>>).req_handlers != "undefined";
}
function is_middleware_binder<T extends Binder<HandlerLike>>(binder: T): binder is Extract<T, Binder<MiddlewareLike>> {
  return typeof (binder as Extract<T, Binder<MiddlewareLike>>).mid_handler != "undefined";
}

/// @brief Inicializa todos handlers de un binder con una respuesta estandar
function init_req_handlers(): Record<ReqMethod, Response> {
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
  /*
    Asocia paths con endpoint handlers y en ocasiones middlewares. Multiples middlewares para un path pueden ser definidos y estos se ejecutaran en el mismo orden en el que fueron definidos.

    Nota: Para un mismo path, los middleware definidos posteriormente a handler binder seran ignorados para evitar http response splitting (esencialmente porque la interfaz de bun trabaja con response on return).
  */
  private binders: Binder<HandlerLike>[] = [];

  /*
    Binds middleware handlers to specific paths. May contain multiple bindings associated with the same path, just as a chain of middleware that will be executed exacly as we had defined.
  */
  private error_binders: Binder<MiddlewareLike>[] = [];

  /*
    Bind method constraints:
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
  public get(path: string, handler: Response | Handler): Binder<Handler> {
    return Server.bind({
      binders_arr: this.binders,
      method: ReqMethods.get,
      path,
      res_generator: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public post(path: string, handler: Response | Handler): Binder<Handler> {
    return Server.bind({
      binders_arr: this.binders,
      method: ReqMethods.post,
      path,
      res_generator: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public patch(path: string, handler: Response | Handler): Binder<Handler> {
    return Server.bind({
      binders_arr: this.binders,
      method: ReqMethods.patch,
      path,
      res_generator: handler
    })
  }

  /// @brief Middleware binding support
  public use(path: string, handler: Response | MiddlewareLike): Binder<MiddlewareLike> {
    return Server.bind({
      binders_arr: this.binders,
      method: AnyReqMethod,
      path,
      res_generator: handler
    })
  }

  /// @brief Error middleware binding support
  public useError(path: string, handler: Response | MiddlewareLike): Binder<MiddlewareLike> {
    return Server.bind({
      binders_arr: this.error_binders,
      method: AnyReqMethod,
      path,
      res_generator: handler
    })
  }

  // TODO: Finish implementation of remaining methods

  public listen(port: number, callback?: () => void): void {
    /* Acceso a miembros de clase desde fetch */
    const binders = this.binders;
    const error_binders = this.error_binders;
    Bun.serve({
      port,
      fetch(req) {
        for (const binder of binders) {
          if (req.url != binder.path)
            continue;

          /* Method verification is important since it could be unrecognized or not supported */
          const method = string_to_method(req.method);
          if (!method) {
            return Response.json({ error: "Unrecognized method" }, { status: 400 })
          }

          /*
            El metodo fetch finaliza en el momento en el que se retorna una respuesta en el metodo fetch. Esto puede suceder en:
              1. Secuencia de middleware
              2. Secuencia de middleware de error (en caso de error en middleware)
              3. Tras finalizar la secuencia de middleware, en el binder handler
          */
          if (is_middleware_binder(binder)) {
            const res_generator = binder.mid_handler
            if (typeof res_generator == "function") {
              /*
                Posibilidades de comportamiento para middlware y middleware de errores:
                  1. Retornar respuesta y error = false (No permitido res + error = true ; ignorado)
                  2. No retornar respuesta y error = false (pasa al sigiente mid)
                  3. No retornar respuesta y error = true (se ejecutan los mid de error)
              */
              let nextcb_output: 0 | 1 | 2 = 2; // Por defecto el estado es 2, es decir, no ejectado
              const res = res_generator(req, (error) => {
                nextcb_output = error ? 1 : 0;
              });

              if (res) // Da salida a la peticion
                return res;

              if (nextcb_output == 2) // Se debe configurar desde el callback cual sera el siguiente paso
                throw new Error("no-response middlewares should call next() callback");

              if (nextcb_output) // Carga los middleware de error
              {
                for (const error_binder of error_binders) {
                  const err_res_generator = error_binder.mid_handler;
                  if (typeof err_res_generator == "function") {
                    let err_nextcb_output: 0 | 1 | 2 = 2; // No ejecutado por defecto.
                    const error_mid_res = err_res_generator(req, (error) => {
                      err_nextcb_output = error ? 1 : 0;
                    });

                    if (error_mid_res)
                      return error_mid_res;

                    if (err_nextcb_output == 2)
                      throw new Error("no-response middlewares should call next() callback");

                    continue;
                  }
                  // TODO: Doesn't have sense a static response middleware
                  // Static response
                  // return res_generatFor;
                }

                // El ultimo middleware de error debe retornar una respuesta incondicionalmente, de lo contrario se lazaremos una excepcion crhaseando el servidor
                throw new Error("No response given in error middleware chain");
              }

              // Siguiente middleware / endpoint handler 
              continue;
            }

            // TODO: Doesn't have sense a static response middleware
            // Static response
            return res_generator;
          }

          // Handler binder response
          const res_generator = binder.req_handlers[method];
          if (typeof res_generator == "function") {
            return res_generator(req);
          }
          return res_generator; // Static response
        }

        const not_found_res = Response.json({ error: "not found" }, { status: 404 });
        return not_found_res;
      }
    });

    callback ? callback() : undefined;
  }
}
