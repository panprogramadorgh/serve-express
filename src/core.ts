/* Generic and global type utilities */

/// @brief Infers return type from function / method
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Endpoint and MiddlewareHandler related types

const endpoint_methods = ["get", "post", "path", "delete"] as const;
type EndpointMethod = typeof endpoint_methods[number];

// Inter handler (either endpoint or middleware) communication
type BindContext = {
  // Internal implementation's shared information across binders
  readonly error_stack: string[],

  // User's responsability (interface consumers may modify freely this object and should merge BindContextData interface for safe type checking)
  data: BindContextData,
}
// Fancy mergeable interface
export interface BindContextData { }

// Final response
export type EndpointHandler = (req: Request, context: BindContext) => Response;

// Middleware
export type MiddlewareHandler = (req: Request, next: MiddlewareNext, context: BindContext) =>
  Response | GetReturnType<MiddlewareNext>;
// Middleware callback
type MiddlewareNext =
  ((message?: string) => { error_stack_piece: string | null })

type HandlerLike = EndpointHandler | MiddlewareHandler;

// Asocia recursos http (paths) con endpoint handlers y middleware
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

function is_endpoint_method(supposted_method: string): supposted_method is EndpointMethod {
  for (const method_name of endpoint_methods) {
    if (method_name == supposted_method)
      return true;
  }
  return false;
}

function is_middleware_next_return(middleware_return: GetReturnType<MiddlewareHandler>):
  middleware_return is GetReturnType<MiddlewareNext> {
  return typeof (middleware_return as GetReturnType<MiddlewareNext>).error_stack_piece != "undefined";
}

/// @brief Inicializa todos handlers de un binder con una respuesta estandar
function create_binder_handlers(): Record<EndpointMethod, Response> {
  const unsupported = Response.json({ error: "Unsupported method" }, { status: 400 });
  return Object.fromEntries(endpoint_methods.map(method_name => {
    return [method_name, unsupported];
  })) as Record<EndpointMethod, Response>; // fromEntries removes type narrowing (compatible string conversion) from EndpointMethod, so assertion is needed
}

/// @brief Initializes the a new bind context, which means, all internal and user-handled shared information across different binders will be instanciated.
function create_bind_context(): BindContext {
  return {
    error_stack: [],
    data: {}
  }
}

/* Server implementation follows */

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

  /// @brief Generic bind method allows new bind entries to be added whithin any binder array
  private static bind<T extends HandlerLike>(options: BindOptions<T>): Binder<T> | never {
    // Searches for latest ocurrence of matching path binder (either it's an endpoint or middleware binder)
    let binder: Binder<HandlerLike> | undefined;
    let bindex = options.binders_arr.length - 1; // Just in case we need to modify the original array
    for (; bindex >= 0; bindex--) {
      if (options.binders_arr[bindex].path == options.path) {
        binder = options.binders_arr[bindex];
        break;
      }
    }

    if (is_middleware_bind_options(options)) {
      if (binder && is_endpoint_binder(binder))
        throw new Error("Middleware must be defined before the path-associated endpoint binder");

      // Addming new middleware to chain
      options.binders_arr.push({
        path: options.path,
        middleware_handler: options.response
      })
    } else if (is_endpoint_bind_options(options)) {
      // Creates a new endpoint binder from scratch  
      if (!binder || (binder && is_middleware_binder(binder))) {
        options.binders_arr.push({
          path: options.path,
          method_handlers: create_binder_handlers()
        });
        bindex = options.binders_arr.length - 1;
      }
      // Overrides the correspondig endpoint method handler
      (options.binders_arr[bindex] as Binder<EndpointHandler>).method_handlers[options.method] = options.response;
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
  public use(path: string, handler: MiddlewareHandler, error_middleware: boolean = false): Binder<MiddlewareHandler> | never {
    return Server.bind<MiddlewareHandler>({
      path,
      binders_arr: error_middleware ? this.error_binders : this.binders,
      response: handler
    })
  }

  // TODO: Finish implementation of remaining methods

  // TODO: Todos los errores logicos lanzados al momento de manejar una peticion deben ser lanzados al momento de configurar el servido y no al momento de captar peticiones

  // FIXME: Arreglar rutas estaticas (al momento de retornar las respuestas, el cuerpo de la respuesta se "consume")

  public listen(port: number, callback?: () => void): void {
    // Acceso a miembros de clase desde fetch
    const binders = this.binders;
    const error_binders = this.error_binders;

    // Just prints defined binders in order to verify if they are configured whithin the binders array
    Bun.serve({
      port,
      fetch(req) {
        // Incoming informatio
        const request_url = new URL(req.url);
        const request_path = request_url.pathname;
        const incoming_method = req.method.toLowerCase();
        if (!is_endpoint_method(incoming_method))
          return Response.json({ error: "Unrecognized method" }, { status: 400 });
        const request_method = incoming_method;

        // Creates the bind context allowing inter binding communication
        const bind_context = create_bind_context();

        // Looks for the response to be sent to client (after executing middleware)
        let bindex = 0;
        while (bindex < binders.length && !(is_endpoint_binder(binders[bindex]) && binders[bindex].path == request_path))
          bindex++;

        /* Internal response handling (404 response is just an example) */

        // TODO: Desplazar responsabilidad de rutas no definidas al usuario consumidor del modulo
        if (bindex >= binders.length) {
          const not_found_res = Response.json({ error: "404 / not-found" }, { status: 404 });
          return not_found_res;
        }

        /* Configures the response to be sent after middleware execution */
        const response = (binders[bindex] as Binder<EndpointHandler>).method_handlers[request_method];

        // Loads standard middleware of requested path
        for (let each_bindex = 0; each_bindex < bindex; each_bindex++) {
          const binder = binders[each_bindex];
          if (binder.path != request_path)
            continue;

          if (is_middleware_binder(binder)) {
            const { middleware_handler } = binder;
            const res = middleware_handler(req, function next(message) {
              if (message && message.trim())
                return { error_stack_piece: message }
              else
                return { error_stack_piece: null };
            }, bind_context);

            if (!is_middleware_next_return(res))
              return res;
            else if (res.error_stack_piece) { // Setps over error middleware
              // Error middleware trigger error_stack_piece should also be pushed
              bind_context.error_stack.push(res.error_stack_piece);

              // Loads error middleware for the requested path
              for (const error_binder of error_binders) {
                if (error_binder.path != request_path)
                  continue;

                const { middleware_handler } = error_binder;
                const error_res = middleware_handler(req, function next(message = "") {
                  if (message.trim()) {
                    return { error_stack_piece: message };
                  }
                  return { error_stack_piece: null };
                }, bind_context);

                if (!is_middleware_next_return(error_res))
                  return error_res;
                else if (error_res.error_stack_piece) {
                  bind_context.error_stack.push(error_res.error_stack_piece);
                }
                // Continues to the next error middleware without pushing any error to error stack
              }

              // Last error middleware should send a response
              throw new Error("No response given in error middleware chain");
            }
            // Steps over the next middleware
          }
          // If is endpoint binder, then ignore it.
        }

        // Sends response to client
        if (typeof response == "function")
          return response(req, bind_context);

        return response;
      }
    });

    callback ? callback() : undefined;
  }
}
