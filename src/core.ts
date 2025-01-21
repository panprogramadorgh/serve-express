/* Generic and global type utilities */

/// @brief Infers return type from function / method
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

/* Endpoint and MiddlewareHandler related types */

// El tipo any es utilizado para los MiddlewareHandler, puesto que las funciones manejadoras para estos trabajan sobre todos los metodos 
const endpoint_methods = ["get", "post", "path", "delete"] as const;
type EndpointMethod = typeof endpoint_methods[number];

// Respuesta final
type EndpointHandler = (req: Request) => Response;

/* El MiddlewareHandler puede ceder la ejecucion al resto de midleware (midleware estandar o MiddlewareHandler de errores). De lo contrario retornara una respuseta.  */
type MiddlewareHandler = (req: Request, next: MiddlewareNext) =>
  Response | GetReturnType<MiddlewareNext>;
/* El mensaje de error se acumula en la pila de errores para el MiddlewareHandler de errores */
type MiddlewareNext = (error_message: string) => string;

type HandlerLike = EndpointHandler | MiddlewareHandler;

/* Asocia recursos http (paths) con endpoint handlers y middleware */
type Binder<T extends HandlerLike> =
  (T extends EndpointHandler ?
    {
      method_handlers: Record<EndpointMethod, Response | EndpointHandler>; // Allows static responses
    } :
    {
      middleware_handler: MiddlewareHandler;
    }) & { path: string };

type BindOptions<T extends HandlerLike> =
  (T extends EndpointHandler ?
    {
      method: EndpointMethod;
      response: Response | T;
    } : {
      response: T
    }) & {
      path: string,
      binders_arr: Binder<HandlerLike>[],
    };

/* Predicates for easy narrowing */
function is_endpoint_binder<T extends Binder<HandlerLike>>(binder: T): binder is Extract<T, Binder<EndpointHandler>> {
  return typeof (binder as Extract<T, Binder<EndpointHandler>>).method_handlers != "undefined";
}
function is_middleware_binder<T extends Binder<HandlerLike>>(binder: T): binder is Extract<T, Binder<MiddlewareHandler>> {
  return typeof (binder as Extract<T, Binder<MiddlewareHandler>>).middleware_handler != "undefined";
}
function is_endpoint_bind_options<T extends BindOptions<HandlerLike>>(bind_options: T): bind_options is Extract<T, BindOptions<EndpointHandler>> {
  return typeof (bind_options as BindOptions<EndpointHandler>).method != "undefined"
}
function is_middleware_bind_options<T extends BindOptions<HandlerLike>>(bind_options: T): bind_options is Extract<T, BindOptions<MiddlewareHandler>> {
  return typeof (bind_options as BindOptions<EndpointHandler>).method == "undefined"
}
function is_endpoint_method(supposted_method: string) {
  let includes = false;
  for (const method_name of endpoint_methods)
    includes = method_name == supposted_method;
  return includes;
}

/// @brief Inicializa todos handlers de un binder con una respuesta estandar
function create_binder_handlers(): Record<EndpointMethod, Response> {
  const unsupported = Response.json({ error: "Unsupported method" }, { status: 400 });
  return Object.fromEntries(endpoint_methods.map(method_name => {
    return [method_name, unsupported];
  })) as Record<EndpointMethod, Response>; // fromEntries removes type narrowing (compatible string conversion) from EndpointMethod, so assertion is needed
}

export class Server {
  /*
    Asocia paths con endpoint handlers y en ocasiones middlewares. Multiples middlewares para un path pueden ser definidos y estos se ejecutaran en el mismo orden en el que fueron definidos.

    Nota: Para un mismo path, los MiddlewareHandler definidos posteriormente a EndpointHandler binder seran ignorados para evitar http response splitting (esencialmente porque la interfaz de bun trabaja con response on return).
  */
  private binders: Binder<HandlerLike>[] = [];

  /*
    Binds MiddlewareHandler handlers to specific paths. May contain multiple bindings associated with the same path, just as a chain of MiddlewareHandler that will be executed exacly as we had defined.
  */
  private error_binders: Binder<MiddlewareHandler>[] = [];

  /*
    Bind method constraints:
      1. Cannot bind a MiddlewareHandler whose path isn't associated with a EndpointHandler-binder
      2. Cannot have two or more EndpointHandler-binders associated with the same path, instead we should only be able to override binder-EndpointHandler method handlers functions if exists (however multiple middlewares may be binded atop the same path)
  */
  private static bind<T extends HandlerLike>(options: BindOptions<T>): Binder<T> | never {
    // Searches for binding
    let binder: Binder<HandlerLike> | undefined;
    let bindex = 0; // Just in case we need to modify the original array
    for (; bindex < options.binders_arr.length; bindex++) {
      if (options.binders_arr[bindex].path == options.path) {
        binder = options.binders_arr[bindex];
        break;
      }
    }

    if (is_middleware_bind_options(options)) {
      // Creating new middleware binder from scratch
      if (binder && is_endpoint_binder(binder)) {
        options.binders_arr.unshift({
          path: options.path,
          middleware_handler: options.response
        });
      }
      // Addming new middleware to chain
      else if (binder && is_middleware_binder(binder)) {
        options.binders_arr.unshift({
          path: options.path,
          middleware_handler: options.response
        })
      } // typeof binder != "undefined")
      else {
        throw new Error("Cannot bind a middleware handler whose path isn't associated with an endpoint handler binder first");
      }
    } else if (is_endpoint_bind_options(options)) {
      // Overrides current handler for the specified method
      if (binder && is_endpoint_binder(binder)) {
        (options.binders_arr[bindex] as Binder<EndpointHandler>).method_handlers[options.method] = options.response;
      }
      // Creates a new endpoint binder from scratch  
      else if (!binder) {
        options.binders_arr.unshift({
          path: options.path,
          method_handlers: create_binder_handlers()
        })
      }
      // In case options.binders_arr breaks constraint 1. then will be ignored (we have taken care in above middleware options parameter if statement)
    } else {
      throw new Error("Run time bind options type checking failure");
    }

    return (binder as unknown) as Binder<Extract<T, HandlerLike>> | never; // All run time type checkings ensures this assertion to be safety
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public get(path: string, handler: Response | EndpointHandler): Binder<EndpointHandler> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "get",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public post(path: string, handler: Response | EndpointHandler): Binder<EndpointHandler> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "post",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public patch(path: string, handler: Response | EndpointHandler): Binder<EndpointHandler> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "path",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public use(path: string, handler: MiddlewareHandler, error?: boolean): Binder<MiddlewareHandler> | never {
    return Server.bind<MiddlewareHandler>({
      path,
      binders_arr: error ? this.error_binders : this.binders,
      response: handler
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
          if (!is_endpoint_method(req.method)) {
            return Response.json({ error: "Unrecognized method" }, { status: 400 })
          }

          /*
            El metodo fetch finaliza en el momento en el que se retorna una respuesta en el metodo fetch. Esto puede suceder en:
              1. Secuencia de MiddlewareHandler
              2. Secuencia de MiddlewareHandler de error (en caso de error en MiddlewareHandler)
              3. Tras finalizar la secuencia de MiddlewareHandler, en el binder EndpointHandler
          */
          if (is_middleware_binder(binder)) {
            const { middleware_handler } = binder;

            /*
                Posibilidades de comportamiento para middlware y MiddlewareHandler de errores:
                  1. Retornar respuesta y error = false (No permitido res + error = true ; ignorado)
                  2. No retornar respuesta y error = false (pasa al sigiente mid)
                  3. No retornar respuesta y error = true (se ejecutan los mid de error)
            */

            // TODO: Arreglar manejo middleware con nuevo sistema de tipos.
            // TODO: Convertir en opcional el parametro de next (siguiente middleware sin saltar a los middleware de error ni escribir en la pila de errores)
            // TODO: Implementar pila de errores para cadena de middleware (argumento de next)

            let nextcb_output: 0 | 1 | 2 = 2; // Por defecto el estado es 2, es decir, no ejectado
            const res = res_generator(req, (error) => {
              nextcb_output = error ? 1 : 0;
            });

            if (res) // Da salida a la peticion
              return res;

            if (nextcb_output == 2) // Se debe configurar desde el callback cual sera el siguiente paso
              throw new Error("no-response middlewares should call next() callback");

            if (nextcb_output) // Carga los MiddlewareHandler de error
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
                // TODO: Doesn't have sense a static response MiddlewareHandler
                // Static response
                // return res_generatFor;
              }

              // El ultimo MiddlewareHandler de error debe retornar una respuesta incondicionalmente, de lo contrario se lazaremos una excepcion crhaseando el servidor
              throw new Error("No response given in error MiddlewareHandler chain");
            }

            // Siguiente MiddlewareHandler / endpoint EndpointHandler 
            continue;
          }

          // EndpointHandler binder response
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
