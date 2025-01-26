import { assert } from "node:console";

/* Generic and global type utilities */

/// @brief Infers return type from function / method
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

/// @brief Generates a filtered copy of an array and narrows it's type
function predicative_filter<T, U>(
  array: T[],
  predicate: (item: T) => item is Extract<U, T>
) {
  return array.filter(predicate);
}

/// @brief Generic utility for secure array item finding
function predicative_find<T, U>(
  array: T[],
  predicate: (item: T) => item is Extract<U, T>,
  match: (item: U) => boolean
) {
  return predicative_filter(array, predicate).find(match);
}

// Endpoint and MiddlewareHandler related types

const endpoint_methods = ["get", "post", "patch", "delete"] as const;
type EndpointMethod = typeof endpoint_methods[number];

// Final response
export type EndpointHandler = (req: Request, context: BindContext) => Response;

// Middleware callback
type MiddlewareNext =
  ((message?: string) => { error_stack_piece: string | null })

// Middleware
export type MiddlewareHandler = (req: Request, next: MiddlewareNext, context: BindContext) =>
  Response | GetReturnType<MiddlewareNext>;

type HandlerLike = EndpointHandler | MiddlewareHandler;

// Fancy mergeable interface
export interface BindContextData { }

// Inter handler (either endpoint or middleware) communication
type BindContext = {
  // Internal implementation's shared information across binders
  readonly error_stack: string[],

  /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
  data: BindContextData,
}

type BinderKinds = "endpoint" | "middleware";
type EndpointKinds = "non-static" | "static";

type EndpointBinder<T extends EndpointKinds> =
  {
    path: string;
    method_handlers: Record<EndpointMethod, T extends "static" ? Response : EndpointHandler>;
  }

type MiddlewareBinder =
  {
    path: string;
    middleware_handler: MiddlewareHandler;
  }

type Binder<T extends BinderKinds, U extends EndpointKinds = "non-static"> =
  T extends "endpoint" ? EndpointBinder<U> : MiddlewareBinder

type BinderLike = (Binder<"endpoint", "non-static"> | Binder<"endpoint", "static">) | Binder<"middleware">;

type BindOptions<T extends BinderLike> =
  (T extends Binder<"endpoint"> | Binder<"endpoint", "static"> ?
    {
      method: EndpointMethod;
      handler: T extends Binder<"endpoint", "static"> ? Response : EndpointHandler;
    } : {
      handler: MiddlewareHandler
    }) & {
      path: string,
    };

/* Predicates for easy narrowing */

function is_endpoint_method(supposted_method: unknown): supposted_method is EndpointMethod {
  if (typeof supposted_method != "string")
    return false;
  for (const method_name of endpoint_methods) {
    if (method_name == supposted_method)
      return true;
  }
  return false;
}

function is_endpoint_binder(binder: unknown): binder is Binder<"endpoint"> {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder))
    return false;
  if (!("method_handlers" in binder))
    return false;
  return typeof binder.method_handlers == "function";
}

function is_middleware_binder(binder: unknown): binder is Binder<"middleware"> {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder))
    return false;
  if (!("middleware_handler" in binder))
    return false;
  return typeof binder.middleware_handler == "function";
}

function is_static_binder(binder: unknown): binder is Binder<"endpoint", "static"> {
  if (typeof binder != "object" || binder == null)
    return false;

  if (!("method_handlers" in binder))
    return false;
  if (typeof binder.method_handlers != "object" || binder.method_handlers == null)
    return false;

  // Ensures binder uses all methods
  for (const method of Object.keys(binder.method_handlers)) {
    if (!(method in binder.method_handlers)) {
      return false;
    }
    const handler = (binder.method_handlers as any)[method];
    if (!(handler instanceof Response))
      return false;
    const required_props = ["status", "ok", "headers", "json", "text", "body"];
    for (const prop of required_props) {
      if (!(prop in handler))
        return false;
    }
  }

  return true;
}

function is_binding_endpoint(bind_options: unknown):
  bind_options is BindOptions<Binder<"endpoint">> {

  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "method"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("handler" in bind_options))
    return false;
  if (typeof bind_options.handler != "function")
    return false;

  return true;
}

function is_binding_static(bind_options: unknown):
  bind_options is BindOptions<Binder<"endpoint">> {

  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "method"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("handler" in bind_options))
    return false;
  if (typeof bind_options.handler == "function")
    return false;

  return true;
}

function is_middleware_next_return(middleware_return: unknown):
  middleware_return is GetReturnType<MiddlewareNext> {
  if (typeof middleware_return != "object" || middleware_return == null)
    return false;
  if (middleware_return instanceof Response)
    return false;
  return "error_stack_piece" in middleware_return;
}

/**
 * @returns Static endpoint binder method handlers
 */
function create_static_binder_methods() {
  const unsupported = Object.freeze(Response.json({ error: "Unsupported method" }, { status: 400 }));
  return endpoint_methods.reduce<Record<EndpointMethod, Response>>((acc, method) => {
    acc[method] = unsupported;
    return acc;
  }, {} as any)
}

/**
 * @returns Non-static endpoint binder method handlers
 */
function create_nonstatic_binder_methods() {
  const unsupported = Object.freeze(() => Response.json({ error: "Unsupported method" }, { status: 400 }));
  return endpoint_methods.reduce<Record<EndpointMethod, EndpointHandler>>((acc, method) => {
    acc[method] = unsupported;
    return acc;
  }, {} as any)
}

/** 
 * @returns Returns a new handler context, allowing inter handler comunication
 */
function create_handler_context(): BindContext {
  return {
    error_stack: [],


    /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
    data: {}
  }
}

/* Server implementation follows */

export class Server {
  /*
    Asocia paths con endpoint handlers y en ocasiones middlewares. Multiples middlewares para un path pueden ser definidos y estos se ejecutaran en el mismo orden en el que fueron definidos.

    Nota: Para un mismo path, los MiddlewareHandler definidos posteriormente a EndpointHandler binder seran ignorados para evitar http response splitting (esencialmente porque la interfaz de bun trabaja con response on return).
  */
  private binders: BinderLike[] = [];

  /*
    Binds MiddlewareHandler handlers to specific paths. May contain multiple bindings associated with the same path, just as a chain of MiddlewareHandler that will be executed exacly as we had defined.
  */
  private error_middleware_binders: Binder<"middleware">[] = [];

  /* Binds static endpoint handlers to paths */
  private static_endpoint_binders: Binder<"endpoint", "static">[] = [];

  /// @brief Generic bind method allows new bind entries to be added whithin any binder array
  private bind(options: BindOptions<BinderLike>): void | never {
    // Searches for latest ocurrence of matching path endpoint endpoint binder (either static or not).
    const last_endpoint_binder = predicative_find(this.binders.toReversed(), is_endpoint_binder, (binder) => binder.path == options.path);
    const last_static_endpoint_binder = this.static_endpoint_binders.find(binder => binder.path == options.path);
    assert(!(last_endpoint_binder && last_static_endpoint_binder), "Cannot define a static endpoint binder and non-static endpoint binder at the same time");
    // In charge of return the final response (either it's satic or not)
    const endpoint_binder = last_endpoint_binder ?? last_static_endpoint_binder;

    // FIXME: TERMINAR
    if (!is_binding_endpoint(options) && !is_binding_static(options)) {
      assert(!endpoint_binder, "Middleware should be defined before the path-associated endpoint binder")
      this.addBinder({ path: options.path, middleware_handler: options.handler }, false);
    } else if (is_binding_endpoint(options) && !endpoint_binder && options.handler instanceof Response) {
      // Crear endpoint binder estatico
      const new_binder = {
        path: options.path,
        method_handlers: create_static_binder_methods()
      } satisfies BinderLike;
      this.setBinderMethod(new_binder, options.method, options.handler);
      this.addBinder(new_binder);
    } else if (is_binding_endpoint(options) && !endpoint_binder && !(options.handler instanceof Response)) {
      // Crear endpoint binder no estatico
      const new_binder = {
        path: options.path,
        method_handlers: create_nonstatic_binder_methods()
      } satisfies BinderLike;
      this.setBinderMethod(new_binder, options.method, options.handler);
      this.addBinder(new_binder);
    } else if (is_binding_endpoint(options) && endpoint_binder) {
      this.setBinderMethod(endpoint_binder, options.method, options.handler);
    }
    else {
      const exhaustiveCheck: never = options;
      throw new Error(`Runtime bind options type checking: ${JSON.stringify(exhaustiveCheck)}`);
    }

    return (binder as unknown) as Binder<Extract<T, HandlerLike>> | never; // All run time type checkings ensures this assertion to be safety
  }

  private addBinder<T extends BinderLike>(binder: T, binder_has_error_middleware: boolean = false): void | never {
    if (is_endpoint_binder(binder) || is_middleware_binder(binder)) {
      if (binder_has_error_middleware && is_middleware_binder(binder)) {
        this.error_middleware_binders.push(binder);
        return;
      }
      this.binders.push(binder);
    } else if (is_static_binder(binder)) {
      this.static_endpoint_binders.push(binder);
    } else {
      const exhaustiveCheck: never = binder;
      throw new Error(`Runtime binder type checking failed: ${exhaustiveCheck}`);
    }
  }

  private setBinderMethod(
    binder: Binder<"endpoint", "static"> | Binder<"endpoint", "non-static">,
    method: EndpointMethod,
    handler: Response | EndpointHandler): void | never {

    if (is_static_binder(binder) && handler instanceof Response) {
      binder.method_handlers[method] = handler;
    }
    else if (!is_static_binder && !(handler instanceof Response)) {
      binder.method_handlers[method] = handler;
    }
    else {
      throw new Error("Discordance between binder type (static and non-static) and binder handler");
    }
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public get(path: string, handler: Response | EndpointHandler): Binder<"endpoint"> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "get",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public post(path: string, handler: Response | EndpointHandler): Binder<"endpoint"> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "post",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public patch(path: string, handler: Response | EndpointHandler): Binder<"endpoint"> | never {
    return Server.bind<EndpointHandler>({
      path,
      binders_arr: this.binders,
      method: "path",
      response: handler
    })
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public use(path: string, handler: MiddlewareHandler, error_middleware: boolean = false): Binder<"middleware"> | never {
    return Server.bind<MiddlewareHandler>({
      path,
      binders_arr: error_middleware ? this.error_middleware_binders : this.binders,
      response: handler
    })
  }

  // TODO: Finish implementation of remaining methods

  // TODO: Todos los errores logicos lanzados al momento de manejar una peticion deben ser lanzados al momento de configurar el servido y no al momento de captar peticiones

  // FIXME: Arreglar rutas estaticas (al momento de retornar las respuestas, el cuerpo de la respuesta se "consume")

  public listen(port: number, callback?: () => void): void {
    // Acceso a miembros de clase desde fetch
    const binders = this.binders;
    const error_middleware_binders = this.error_middleware_binders;

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
        const response = (binders[bindex] as Binder<"endpoint">).method_handlers[request_method];

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
              for (const error_binder of error_middleware_binders) {
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
