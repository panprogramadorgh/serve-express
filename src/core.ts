import { AssertionError } from "node:assert";

/* Generic and global type utilities */

export const error_middleware = true;

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

/**
 * Allows assertion and type narrowing at the same time 
 * @param data Any data to predicate
 * @param predicate Predication logic
 * @param message Message to print out if `predicate` fails
 * @returns Boolean as a type predicate
 * @example
 * 
 * 
  const my_array: [true, false] | [false, true] = [true, false];
  predicative_assert<[true, false]>(my_array, "Wrong value was provided", (d) => {
    if (typeof d != "object" || d == null)
      return false;
    if (!(d instanceof Array))
      return false;
    if (d.length != 2)
      return false;
    if (d[0] != true || d[1] != false)
      return false;

    return true;
  });

  my_array // [true, false]

 */
function predicative_assert<T = true>(data: unknown, message: string, predicate: (d: unknown) => d is T = (d): d is T => d == true): asserts data is T {
  if (!predicate(data))
    throw new AssertionError({ message });
}

/* Endpoint and MiddlewareHandler related types */

// TODO: Add corresponding Server methods to bind the remaining http methods
const endpoint_methods = ["get", "post", "patch", "delete"] as const;
type EndpointMethod = typeof endpoint_methods[number];

/**
 * Type used inside non-static method_handlers binder
 */
type EndpointHandler = (req: Request, context: BindContext) => Response;

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
  readonly data: BindContextData,
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
export type EndpointBinder<T extends EndpointKind> =
  {
    path: string;
    method_handlers: Record<EndpointMethod, T extends "static" ? Response : EndpointHandler>;
  }

/**
 * Type union for all kind of endpoint binders
 */
export type EndpointBinderLike = EndpointBinder<"static"> | EndpointBinder<"non-static">

/**
 * The only possibe middleware binder type
 */
export type MiddlewareBinder =
  {
    path: string;
    middleware_handler: MiddlewareHandler;
  }

/**
 * Generic that bundlers all variants of binder type
 */
export type Binder<T extends BinderKind, U extends EndpointKind = "non-static"> =
  T extends "endpoint" ? EndpointBinder<U> : MiddlewareBinder

/**
 * Type union of all possible binder type variants
 */
export type BinderLike = EndpointBinderLike | Binder<"middleware">;

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

/**
 * Used as handleChain parameter.
 */
type HandleChainOptions<T extends BinderChain = BinderChain> = {
  // The incoming http request
  req: Request;

  // Shared information across binders
  context: BindContext;

  // The binder chain where from we take the binders to process the request and return a responses
  chain: T;

  /**
   * Sets how we manage `next` callback calls whos message argument is provided.
   * @type next_chain: We halt binder execution and notice method caller to take the next binder chain on.
   * @type next_binder: The `next` callback argument (the error message) is still pushed to `context.error_stack` but the method behaves in a manner it continues with the remaining binders until it finds a response or throw an error if there were not.
   */
  step_behaviour: "next_chain" | "next_binder" // finish
}

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
 * Predicates whether if binder is BinderLike type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_binder(binder: unknown): binder is BinderLike {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder) || typeof binder.path != "string")
    return false;

  let method_handlers = false;

  if (
    ("method_handlers" in binder) &&
    typeof binder.method_handlers == "object" && binder.method_handlers != null &&
    Object.keys(binder.method_handlers).join("") == endpoint_methods.join("")
  ) {
    const method_handlers_array = Object.values(binder.method_handlers);
    method_handlers = true;

    // Ensures all method_handlers are the same type (either response or function)
    const is_static_binder = is_response(method_handlers_array[0]);
    for (const method_handler of method_handlers_array) {
      if (
        (is_static_binder && is_response(method_handler)) ||
        (!is_static_binder && typeof method_handler == "function")
      ) continue;

      method_handlers = false;
      break;
    }
  }

  const middleware_handler = ("middleware_handler" in binder) && typeof binder.middleware_handler == "function";

  // Exclusive or
  if (!(method_handlers || middleware_handler)) {
    return false;
  }
  if (method_handlers && middleware_handler) {
    return false;
  }

  return true;
}

/**
 * Predicates whether if binder is Binder<"endpoint"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
function is_endpoint_binder(binder: unknown): binder is Binder<"endpoint"> {
  if (!is_binder(binder))
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
    const handler = binder.method_handlers[method];
    if (!is_response(handler) && typeof handler != "function")
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
  if (!is_binder(binder))
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
  if (!is_binder(binder))
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

/**
 * Eases the access to binders that depends of a specific path.
 * @example
 * 
 * const my_binders = [
 *  {
 *    path: "/profile/dashboard",
 *    method_handlers: {
 *      get, Response.json({ message: "hello get" }),
 *      post, Response.json({ message: "hello post" }),
 *      patch, Response.json({ message: "hello path" }),
 *      delete, Response.json({ message: "hello delete" }),
 *    }
 *  } 
 * ]
 * 
 * const chain = new BinderChain(my_binders);
 * const valid_binders = chain.get("/profile") // Returns all binders that depend on /profile, such as /profile/dashboard
 */
export class BinderChain<T extends BinderLike = BinderLike> {
  private binders: T[] = [];

  constructor(initial_binders?: T[]) {
    if (initial_binders) this.binders.push(...initial_binders);
  }

  public add(binder: T) {
    this.binders.push(binder);
  }

  public getFiltered(path: string) {
    const filtered_binders = predicative_filter(this.binders, (item): item is T => {
      if (!is_binder(item))
        return false;
      return (
        (is_middleware_binder(item) && item.path.startsWith(path)) ||  
        (is_middleware_binder(item) && item.path == "/") ||
        (is_endpoint_binder(item) && item.path == path)
      );
    });

    return filtered_binders;
  }

  public getTail<U extends T>(path: string = "/", predicate: (item: T) => item is U) {
    const last_binder = predicative_find(
      this.binders.toReversed(),
      (binder): binder is Extract<U, T> => {
        return predicate(binder);
      },
      (binder) => {
        return binder.path == path;
      });
    return last_binder;
  }
}

/* Server implementation follows */

export class Server {
  /*
    Asocia paths con endpoint handlers y en ocasiones middlewares. Multiples middlewares para un path pueden ser definidos y estos se ejecutaran en el mismo orden en el que fueron definidos.

    Nota: Para un mismo path, los MiddlewareHandler definidos posteriormente a EndpointHandler binder seran ignorados para evitar http response splitting (esencialmente porque la interfaz de bun trabaja con response on return).
  */
  // private binders: BinderLike[] = [];
  private binders = new BinderChain();

  /*
    Binds MiddlewareHandler handlers to specific paths. May contain multiple bindings associated with the same path, just as a chain of MiddlewareHandler that will be executed exacly as we had defined.
  */
  // private error_middleware_binders: Binder<"middleware">[] = [];
  private error_middleware_binders = new BinderChain<Binder<"middleware">>();

  /// @brief Generic bind method allows new bind entries to be added whithin any binder array
  public bind<T extends BindOptions<BinderLike>>(options: T): void | never {
    if (is_binding_middleware(options)) {
      return this.addBinder({ path: options.path, middleware_handler: options.handler }, options.is_error_middleware);
    }

    // Searches for latest ocurrence of matching path endpoint endpoint binder (either static or not).
    const last_endpoint_binder = this.binders.getTail(options.path, is_endpoint_binder);
    const last_static_endpoint_binder = this.binders.getTail(options.path, is_static_binder)

    predicative_assert(!(last_static_endpoint_binder && last_endpoint_binder), "Cannot define a static endpoint binder and non-static endpoint binder for the same path");
    // In charge of return the final response (either it's satic or not)
    const endpoint_binder = last_endpoint_binder ?? last_static_endpoint_binder;

    if (is_binding_middleware(options)) {
      this.addBinder({ path: options.path, middleware_handler: options.handler }, options.is_error_middleware);
    }
    // Static endpoint handler binding 
    else if (is_binding_static(options)) {
      if (endpoint_binder) {
        Server.setBinderMethod(endpoint_binder, options.method, options.handler);
      }
      else {
        const new_binder = {
          path: options.path,
          method_handlers: create_static_binder_methods()
        } satisfies BinderLike;

        Server.setBinderMethod(new_binder, options.method, options.handler);
        this.addBinder(new_binder);
      }
    }
    // Non-static endpoint handler binding
    else if (is_binding_endpoint(options)) {
      if (endpoint_binder) {
        Server.setBinderMethod(endpoint_binder, options.method, options.handler);
      }
      else {
        const new_binder = {
          path: options.path,
          method_handlers: create_nonstatic_binder_methods()
        } satisfies BinderLike;

        Server.setBinderMethod(new_binder, options.method, options.handler);
        this.addBinder(new_binder);
      }
    }
    // Runtime and compiling time type checking
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
      this.error_middleware_binders.add(binder);
    }
    else if (is_middleware_binder(binder)) {
      this.binders.add(binder);
    }
    else if (is_endpoint_binder(binder) || is_static_binder(binder)) {
      this.binders.add(binder);
    } else {
      const exhaustiveCheck: never = binder;
      throw new Error(`Runtime binder type checking failed: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  private static setBinderMethod<T extends EndpointBinderLike>(
    binder: T,
    method: EndpointMethod,
    handler: T extends Binder<"endpoint", "static"> ? Response : EndpointHandler): void | never {
    if (is_static_binder(binder)) {
      predicative_assert(handler, "Handler was expected to be a response", is_response);
      binder.method_handlers[method] = handler;
    }
    else if (is_endpoint_binder(binder)) {
      predicative_assert(
        handler,
        "Handler was expected to be a endpoint binder handler",
        (d): d is EndpointHandler => {
          return !is_response(d);
        });
      binder.method_handlers[method] = handler;
    }
    else {
      const exhaustiveCheck: never = binder;
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

  /**
   * Executes all binders in `options.chain` looking for http responses. The kind of binders `options.chain` has is controlled by the generic `U extends BinderChain`
   * @param options 
   * @returns The response generad by the binder chain or, undefined, if there were not one and thus, there were a middleware binder that made use of `next` callback with some message as argument (whose case next binder chain (AKA error middleware chain) have to take place)
   * @throws An error is thrown either if no responses are generated or no middleware next callback is used with a message as argument -- the server is wrongly configured and is interface consumer responsability to make proper use of it.
   */
  private static handleChain<U extends BinderChain>(options: HandleChainOptions<U>): Response | undefined {
    const req_url = new URL(options.req.url);
    const req_method = options.req.method.toLowerCase();
    if (!is_endpoint_method(req_method))
      return Response.json({ error: "Unsupported request http method." });

    // FIXME: `options.chain` has correctly defined some binders but the filter isn't working as spected
    const req_path_binders = options.chain.getFiltered(req_url.pathname);

    for (const binder of req_path_binders) {
      // Middlewares could either return a response or step over the next binder / binder chain
      if (is_middleware_binder(binder)) {
        let next_callback_was_called = false;
        const mid_return = binder.middleware_handler(options.req, (msg) => {
          next_callback_was_called = true;
          // Run time type checking avoids to push invalid data to contexto error messages stack
          return { error_stack_piece: typeof msg == "string" ? msg : undefined };
        }, options.context);

        if (is_response(mid_return)) {
          return mid_return;
        }
        else if (((a): a is GetReturnType<MiddlewareNext> => next_callback_was_called)(mid_return)) {
          const msg = mid_return.error_stack_piece;
          if (!msg) continue;
          options.context.error_stack.push(msg);

          // We inform `handleChain` caller, we should step to next binder chain (if appropiated)
          if (options.step_behaviour == "next_chain")
            return;
        } else {
          const exhaustiveCheck: never = mid_return;
          throw new Error(
            `Middleware response run time type checking error : ${JSON.stringify(
              exhaustiveCheck
            )}`
          );
        }

        continue;
      }

      const method_handler = binder.method_handlers[req_method]
      if (is_response(method_handler))
        return method_handler;

      const generated_response = method_handler(options.req, options.context);
      // Just in sake of security we run-time-ensure we've got a response to provide
      if (is_response(generated_response))
        return generated_response;

      throw new Error(`Endpoint response run time type checking error : ${JSON.stringify(generated_response)}`);
    }
  }

  /**
   * After all handlers and middleware (binders) are configured, `listen` raises the http server on `port`.
   * @param port The http port (i.e 80, 3000 or 8080)
   * @param callback If neither of the server configuration methods throws an exception (the server is correctly configured), callback is executed.
   */
  public listen(port: number, callback?: () => void): void {
    // Acceso a miembros de clase desde fetch
    const { error_middleware_binders, binders } = this;
    // Creates a brand new context in sake of binder communication
    const virgin_context = create_handler_context();

    // Just prints defined binders in order to verify if they are configured whithin the binders array
    Bun.serve({
      port,
      fetch(req) {
        // Copies a blank context
        const context = { ...virgin_context } satisfies BindContext;

        const main_chain_response = Server.handleChain({
          req, chain: binders, context, step_behaviour: "next_chain"
        })
        if (main_chain_response)
          return main_chain_response;

        const err_mid_chain_response = Server.handleChain({
          req, chain: error_middleware_binders, context, step_behaviour: "next_binder"
        })
        if (err_mid_chain_response)
          return err_mid_chain_response;

        console.error(new Error(`Unhandeled http request : ${req.url}`));
        process.exit(1);
      }
    });

    callback ? callback() : undefined;
  }
}
