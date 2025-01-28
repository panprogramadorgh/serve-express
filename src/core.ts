import { assert } from "node:console";

/* Generic and global type utilities */

/**
 * Infers return type from function / method
 */
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

/**
 * Generates a filtered copy of an array and narrows it's type
 * @param array Any array of any type
 * @param predicate Type predicate callback in charge of fiiltering the array items
 */
function predicative_filter<T, U>(
  array: T[],
  predicate: (item: T) => item is Extract<U, T>
) {
  return array.filter(predicate);
}

/**
 * Generic utility for secure type array item finding
 * @param array Any array of any type
 * @param predicate Type predicate callback in charge of filtering the array items
 * @param match Onces whithin the array there is only one type of item, `match` callback is in charge of finding one item across it.
 */
function predicative_find<T, U>(
  array: T[],
  predicate: (item: T) => item is Extract<U, T>,
  match: (item: U) => boolean
) {
  return predicative_filter(array, predicate).find(match);
}

/* Endpoint and MiddlewareHandler related types */

const endpoint_methods = ["get", "post", "patch", "delete"] as const;
type EndpointMethod = typeof endpoint_methods[number];

/**
 * Type used inside non-static method_handlers binder
 */
export type EndpointHandler = (req: Request, context: BindContext) => Response;

/**
 * Callback provided in middleware handler binders
 * @param message When isn't an empty string, will push into the error_stack prop inside the binder context (which is accesible for any kind of binder method). Then the error middleware chain will start executing at the error middleware in head.
 */
type MiddlewareNext =
  ((message?: string) => { error_stack_piece: string | undefined })

/**
 * Middleware binder handler. We use the same type of callbacks for standard middlewares and error middlewares, since both can the access the error stack inside context as given function parameter.
 * @param req Represents the incoming http request as a fetch API Response interface
 * @param next Next callback controls whether we step over the next middleware / final endpoint or we just enter into the error middleware chain
 */
export type MiddlewareHandler = (req: Request, next: MiddlewareNext, context: BindContext) =>
  Response | GetReturnType<MiddlewareNext>;


/**
 * This fancy mergeable interface allows module consumers determine what will be store across al binders inside the data field of handler context.
 * ```typescript
 * declare module "serve-express" {
 *  interface BindContextData {
 *    user: {
 *      uid: string;
 *      name: string;
 *      type: "admin" | "standard"
 *    } 
 *   }  
 * }
 * ```
 */
export interface BindContextData { }

/**
 * Allows inter handler (either endpoint or middleware) communication. Bind context object is common for al handlers and is accesible from the binder method / handler_methos
 */
type BindContext = {
  // Internal implementation's shared information across binders
  readonly error_stack: string[],

  /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
  data: BindContextData,
}

/**
 * Sets whether binder is endpoint or middleware kind
 */
type BinderKind = "endpoint" | "middleware";

/**
 * Sets whether the endpoint binder uses handler endpoint functions or static generated Responses
 */
type EndpointKind = "non-static" | "static";

/**
 * Generic for all kind of endpoint binders
 */
type EndpointBinder<T extends EndpointKind> =
  {
    path: string;
    method_handlers: Record<EndpointMethod, T extends "static" ? Response : EndpointHandler>;
  }

/**
 * Type union for all kind of endpoint binders
 */
type EndpointBinderLike = EndpointBinder<"static"> | EndpointBinder<"non-static">

/**
 * The only possibe middleware binder type
 */
type MiddlewareBinder =
  {
    path: string;
    middleware_handler: MiddlewareHandler;
  }

/**
 * Generic that bundlers all variants of binder type
 */
type Binder<T extends BinderKind, U extends EndpointKind = "non-static"> =
  T extends "endpoint" ? EndpointBinder<U> : MiddlewareBinder

/**
 * Type union of all possible binder type variants
 */
type BinderLike = EndpointBinderLike | Binder<"middleware">;

/**
 * Helps getting the appropiated handler type for all kind of binders
 */
type GetHandlerKind<T extends BinderLike> =
  T extends EndpointBinderLike ?
  (T extends Binder<"endpoint", "static"> ? Response : EndpointHandler) :
  MiddlewareHandler

/**
 * Used as a bind method parameter and privides an easy to use way of setting / addming a new binder to the specific server instance.
 */
type BindOptions<T extends BinderLike> =
  (T extends EndpointBinderLike ?
    {
      method: EndpointMethod;
      handler: GetHandlerKind<T>
    } : {
      is_error_middleware: boolean;
      handler: MiddlewareHandler;
    }) & {
      path: string;
    };

/* Predicates for easy narrowing */

/**
 * Predicates whether if `supposted_method` is whether or not of EndpointMethod type
 * @param supposted_method Is fully secure passing any type to this parameter
 * @returns Boolean as a type predicate
 */
function is_endpoint_method(supposted_method: unknown): supposted_method is EndpointMethod {
  if (typeof supposted_method != "string")
    return false;
  for (const method_name of endpoint_methods) {
    if (method_name == supposted_method)
      return true;
  }
  return false;
}

/**
 * Predicates whether if binder is Binder<"endpoint"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_endpoint_binder(binder: unknown): binder is Binder<"endpoint"> {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder))
    return false;
  if (!("method_handlers" in binder))
    return false;
  if (typeof binder.method_handlers != "object" || binder.method_handlers == null)
    return false;

  // Ensures binder uses all methods (and are static responses)
  const this_binder_methods = Object.keys(binder.method_handlers);
  for (const method of endpoint_methods) {
    if (!(this_binder_methods.includes(method)))
      return false;
    const handler = (binder.method_handlers as Record<EndpointMethod, unknown>)[method]
    if (typeof handler != "function")
      return false;
  }

  return true;
}

/**
 * Whether if binder is Binder<"endpoint", "static"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_static_binder(binder: unknown): binder is Binder<"endpoint", "static"> {
  if (typeof binder != "object" || binder == null)
    return false;

  if (!("method_handlers" in binder))
    return false;
  if (typeof binder.method_handlers != "object" || binder.method_handlers == null)
    return false;

  // Ensures binder uses all methods (and are static responses)
  const this_binder_methods = Object.keys(binder.method_handlers);
  for (const method of endpoint_methods) {
    if (!(method in this_binder_methods))
      return false;
    const handler = (binder.method_handlers as Record<EndpointMethod, unknown>)[method]
    if (!is_response(handler))
      return false;
  }

  return true;
}

/**
 * Predicates whether if binder is Binder<"endpoint"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_middleware_binder(binder: unknown): binder is Binder<"middleware"> {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder))
    return false;
  if (!("middleware_handler" in binder))
    return false;
  return typeof binder.middleware_handler == "function";
}

/**
 * Predicates whether if bind_options argument is BindOptions<Binder<"endpoint">> type
 * @param bind_options Any variable of any type
 * @returns Boolean as a type predicate
 */
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
  return typeof bind_options.handler == "function";
}

/**
 * Predicates whether if bind_options argument is BindOptions<Binder<"endpoint", "static">> type
 * @param bind_options  Any varible of any type
 * @returns 
 */
function is_binding_static(bind_options: unknown):
  bind_options is BindOptions<Binder<"endpoint", "static">> {
  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "method"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("handler" in bind_options))
    return false;
  return is_response(bind_options.handler);
}

/**
 * Predicates whether if bind_options is BindOptions<Binder<"middleware">>
 * @param bind_options Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_binding_middleware(bind_options: unknown):
  bind_options is BindOptions<Binder<"middleware">> {
  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "is_error_middleware"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("handler" in bind_options))
    return false;
  return typeof bind_options.handler == "function";
}

/**
 * Predicates whether if response is a fetch API reponse interface or not
 * @param response Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_response(response: unknown): response is Response {
  if (typeof response != "object" || response == null)
    return false;
  if (!(response instanceof Response))
    return false;
  const required_props = ["status", "ok", "headers", "json", "text", "body"];
  for (const prop of required_props) {
    if (!(prop in response))
      return false;
  }
  return true;
}

/**
 *  Predicates whether if middleware_return is acctually a value generated by some next callback call 
 * @param middleware_return Any value of any type
 * @returns Boolean as a type predicate
 */
function is_middleware_next_return(middleware_return: unknown):
  middleware_return is GetReturnType<MiddlewareNext> {
  if (typeof middleware_return != "object" || middleware_return == null)
    return false;
  if (is_response(middleware_return))
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
  public bind<T extends BindOptions<BinderLike>>(options: T): void | never {
    // Searches for latest ocurrence of matching path endpoint endpoint binder (either static or not).
    const last_endpoint_binder = predicative_find(this.binders.toReversed(), is_endpoint_binder, (binder) => binder.path == options.path);
    const last_static_endpoint_binder = this.static_endpoint_binders.find(binder => binder.path == options.path);
    assert(!(last_endpoint_binder && last_static_endpoint_binder), "Cannot define a static endpoint binder and non-static endpoint binder at the same time");
    // In charge of return the final response (either it's satic or not)
    const endpoint_binder = last_endpoint_binder ?? last_static_endpoint_binder;

    if (is_binding_middleware(options)) {
      assert(!endpoint_binder || options.is_error_middleware, "Middleware should be defined before the path-associated endpoint binder")

      this.addBinder({ path: options.path, middleware_handler: options.handler }, options.is_error_middleware);
    } else if (is_binding_static(options)) {
      if (endpoint_binder) {
        this.setBinderMethod(endpoint_binder, options.method, options.handler);
      } else {
        const new_binder = {
          path: options.path,
          method_handlers: create_static_binder_methods()
        } satisfies BinderLike;

        this.setBinderMethod(new_binder, options.method, options.handler);
        this.addBinder(new_binder);
      }
    } else if (is_binding_endpoint(options)) {
      if (endpoint_binder) {
        this.setBinderMethod(endpoint_binder, options.method, options.handler);
      } else {
        const new_binder = {
          path: options.path,
          method_handlers: create_nonstatic_binder_methods()
        } satisfies BinderLike;

        this.setBinderMethod(new_binder, options.method, options.handler);
        this.addBinder(new_binder);
      }
    }
    else {
      const exhaustiveCheck: never = options;
      throw new Error(`Runtime bind options type checking: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  private addBinder<T extends BinderLike>(
    binder: T,
    binder_has_error_middleware: T extends Binder<"middleware"> ? boolean : false = false
  ): void | never {
    if (binder_has_error_middleware && is_middleware_binder(binder)) {
      this.error_middleware_binders.push(binder);
    }
    else if (is_middleware_binder(binder)) {
      this.binders.push(binder);
    }
    else if (is_endpoint_binder(binder)) {
      this.binders.push(binder);
    } else if (is_static_binder(binder)) {
      this.static_endpoint_binders.push(binder);
    } else {
      const exhaustiveCheck: never = binder;
      throw new Error(`Runtime binder type checking failed: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  // TODO: Implementar assert type predicate
  private setBinderMethod<T extends EndpointBinderLike>(
    binder: T,
    method: EndpointMethod,
    handler: T extends Binder<"endpoint", "static"> ? Response : EndpointHandler): void | never {
    if (is_static_binder(binder)) {
      assert(is_response(handler), "Handler was expected to be a response");
      binder.method_handlers[method] = handler as Response;
    }
    else if (is_endpoint_binder(binder)) {
      assert(!is_response(handler), "Handler was expected to be a endpoint binder handler");
      binder.method_handlers[method] = handler as EndpointHandler;
    }
    else {
      const exhaustiveCheck: never = binder;
      console.log(exhaustiveCheck);
      throw new Error(`Mismatch in binder type (static or non-static) and binder handler : ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public get(
    path: string,
    handler: GetHandlerKind<EndpointBinderLike>): void | never {
    // Helps TS to find the sign overload
    if (is_response(handler)) {
      return this.bind({
        path,
        method: "get",
        handler
      });
    }
    return this.bind({
      path,
      method: "get",
      handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public post(
    path: string,
    handler: GetHandlerKind<EndpointBinderLike>): void | never {
    // Helps TS to find the sign overload
    if (is_response(handler)) {
      return this.bind({
        path,
        method: "post",
        handler
      });
    }
    return this.bind({
      path,
      method: "post",
      handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public patch(
    path: string,
    handler: GetHandlerKind<EndpointBinderLike>): void | never {
    // Helps TS to find the sign overload
    if (is_response(handler)) {
      return this.bind({
        path,
        method: "patch",
        handler
      });
    }
    return this.bind({
      path,
      method: "patch",
      handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public use(
    path: string,
    handler: MiddlewareHandler,
    is_error_middleware: boolean = false): void | never {
    return this.bind({
      path,
      handler,
      is_error_middleware
    });
  }

  // TODO: Finish implementation of remaining methods

  // TODO: Todos los errores logicos lanzados al momento de manejar una peticion deben ser lanzados al momento de configurar el servido y no al momento de captar peticiones

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

        // Looks for the response to be sent to client (after executing middleware)
        let endpoint_binder_index = -1;
        const endpoint_binder = binders.reduce<EndpointBinderLike | undefined>((acc, binder, index) => {
          if (!is_middleware_binder(binder) && binder.path == request_path) {
            endpoint_binder_index = index;
            return binder;
          }
        }, undefined);

        // Creates the handler context allowing inter handler communication
        const context = create_handler_context();

        /* Internal response handling (404 response is just an example) */

        // TODO: Desplazar responsabilidad de rutas no definidas al usuario consumidor del modulo
        if (!endpoint_binder) {
          const not_found_res = Response.json({ error: "404 / not-found" }, { status: 404 });
          return not_found_res;
        }

        // TODO: Mejorar (basicamente inicializa los valores con lo que extraiga de los forEach de los middleware binders) -----------
        let middleware_response: Response | GetReturnType<MiddlewareNext> | undefined = undefined;
        let error_middleware_response: Response | GetReturnType<MiddlewareNext> | undefined = undefined;
        // -----------------------------------------------

        const middleware_chain = predicative_filter(
          binders.slice(0, endpoint_binder_index),
          (binder): binder is Binder<"middleware"> => {
            return binder.path == request_path && is_middleware_binder(binder);
          })
        const error_middleware_chain = predicative_filter(error_middleware_binders, (error_middleware_binder): error_middleware_binder is Binder<"middleware"> => {
          return error_middleware_binder.path == request_path;
        })

        // TODO: Utilizar enfoque con for of
        // for (const binder of middleware_chain) { }

        // We filter the binders that are not middleware kind and the ones whos path does not match with request_path
        predicative_filter(
          binders.slice(0, endpoint_binder_index),
          (binder): binder is Binder<"middleware"> => {
            return binder.path == request_path && is_middleware_binder(binder);
          })
          // We executes all middleware in chain
          .forEach((binder) => {
            middleware_response = binder.middleware_handler(req, function next(error_stack_piece) {
              return { error_stack_piece }
            }, context);
            if (is_response(middleware_response))
              return;
            else if (is_middleware_next_return(middleware_response)) { // Loads error middleware
              if (!middleware_response.error_stack_piece) return;
              // We push the trigger next error message to the error stack
              context.error_stack.push(middleware_response.error_stack_piece);

              // We filter the binders where the path does not match
              predicative_filter(error_middleware_binders, (error_middleware_binder): error_middleware_binder is Binder<"middleware"> => {
                return error_middleware_binder.path == request_path;
              })
                // We execute each error binder middleware in chain
                .forEach(error_middleware_binder => {
                  error_middleware_response = error_middleware_binder.middleware_handler(req, function next(error_stack_piece) {
                    return { error_stack_piece };
                  }, context);

                  if (is_response(error_middleware_response))
                    return;
                  else if (is_middleware_next_return(error_middleware_response)) {
                    if (!error_middleware_response.error_stack_piece) return;
                    context.error_stack.push(error_middleware_response.error_stack_piece);
                  }
                  else {
                    const exhaustiveCheck: never = error_middleware_response;
                    throw new Error(`Error middleware response run time type cheking error : ${JSON.stringify(exhaustiveCheck)}`)
                  }
                })
              throw new Error("Error middleware chain should return a response");
            } else {
              const exhaustiveCheck: never = middleware_response;
              throw new Error(`Middleware response run time type checking error : ${JSON.stringify(exhaustiveCheck)}`);
            }
          });

        // If middlewares have returned a response, it is sent to the client
        if (middleware_response)
          return middleware_response;
        else if (error_middleware_response)
          return error_middleware_response;

        // Sends endpoint binder response to the client
        if (is_static_binder(endpoint_binder))
          return endpoint_binder.method_handlers[request_method];
        return endpoint_binder.method_handlers[request_method](req, context);
      }
    });

    callback ? callback() : undefined;
  }
}
