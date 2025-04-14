/**
 * Provides the api consumer the Server class to configure and quickly raise the http server.
 */

import BinderChain from "./binder-chain" // Response handling interface
import * as predicates from "./predicates" // Type predicates dedicated module
import { Internal } from "./definitions"

/* ServerBase's bind method utils. */
namespace BindUtils {
  /**
   * Used as a bind method parameter and privides an easy to use way of setting / addming a new binder to the specific server instance.
   */
  export type BindOptions<T extends Internal.Binder> =
    (T extends Internal.EndpointBinder ?
      {
        method: Internal.EndpointMethod;
        handler: Internal.GetHandlerKind<T>
      } : {
        is_error_middleware: boolean;
        handler: MiddlewareHandler;
      }) & {
        path: string;
      };

  /* Bind related utility functions */

  /**
   * @returns Static endpoint binder method handlers
   */
  export function create_static_binder_methods() {
    const unsupported = Object.freeze(Response.json({ error: "Unsupported method" }, { status: 400 }));
    return Internal.endpoint_methods.reduce<Record<Internal.EndpointMethod, Response>>((acc, method) => {
      acc[method] = unsupported;
      return acc;
    }, {} as any)
  }

  /**
   * @returns Non-static endpoint binder method handlers
   */
  export function create_nonstatic_binder_methods() {
    const unsupported = Object.freeze(() => Response.json({ error: "Unsupported method" }, { status: 400 }));
    return Internal.endpoint_methods.reduce<Record<Internal.EndpointMethod, EndpointHandler>>((acc, method) => {
      acc[method] = unsupported;
      return acc;
    }, {} as any)
  }

  /* Bind related type predicates */

  /**
   * Predicates whether if bind_options argument is BindOptions<Binder<"endpoint">> type
   * @param bind_options Any variable of any type
   * @returns Boolean as a type predicate
   */
  export function is_binding_endpoint(bind_options: unknown):
    bind_options is BindOptions<Internal.EndpointBinder<"non-static">> {
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
  export function is_binding_static(bind_options: unknown):
    bind_options is BindOptions<Internal.EndpointBinder<"static">> {
    if (typeof bind_options != "object" || bind_options == null)
      return false;
    const required_props = ["path", "method"];
    for (const prop of required_props) {
      if (!(prop in bind_options))
        return false;
    }
    if (!("handler" in bind_options))
      return false;
    return predicates.is_response(bind_options.handler);
  }

  /**
   * Predicates whether if bind_options is BindOptions<Binder<"middleware">>
   * @param bind_options Any variable of any type
   * @returns Boolean as a type predicate
   */
  export function is_binding_middleware(bind_options: unknown):
    bind_options is BindOptions<Internal.MiddlewareBinder> {
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
}

/* ServerBase implementation follows */

/**
 * Contains all the low level logic of this programming interface.
 * - HTTP raw resource binding, and
 * - BinderChain handling utilities
 */
class ServerBase {
  private binders = new BinderChain();

  /*
    Binds MiddlewareHandler handlers to specific paths. May contain multiple bindings associated with the same path, just as a chain of MiddlewareHandler that will be executed exacly as we had defined.
  */
  private error_middleware_binders = new BinderChain<Internal.MiddlewareBinder>();

  /// @brief Generic bind method allows new bind entries to be added whithin any binder array
  public bind<T extends BindUtils.BindOptions<Internal.Binder>>(options: T): void | never {
    if (BindUtils.is_binding_middleware(options)) {
      return this.addBinder({ path: options.path, middleware_handler: options.handler }, options.is_error_middleware);
    }

    // Searches for latest ocurrence of matching path endpoint endpoint binder (either static or not).
    const last_endpoint_binder = this.binders.getTail(options.path, predicates.is_endpoint_binder);
    const last_static_endpoint_binder = this.binders.getTail(options.path, predicates.is_static_binder)

    predicates.predicative_assert(!(last_static_endpoint_binder && last_endpoint_binder), "Cannot define a static endpoint binder and non-static endpoint binder for the same path");
    // In charge of return the final response (either it's satic or not)
    const endpoint_binder = last_endpoint_binder ?? last_static_endpoint_binder;

    if (BindUtils.is_binding_middleware(options)) {
      this.addBinder({ path: options.path, middleware_handler: options.handler }, options.is_error_middleware);
    }
    // Static endpoint handler binding 
    else if (BindUtils.is_binding_static(options)) {
      if (endpoint_binder) {
        Server.setBinderMethod(endpoint_binder, options.method, options.handler);
      }
      else {
        const new_binder = {
          path: options.path,
          method_handlers: BindUtils.create_static_binder_methods()
        } satisfies Internal.Binder;

        Server.setBinderMethod(new_binder, options.method, options.handler);
        this.addBinder(new_binder);
      }
    }
    // Non-static endpoint handler binding
    else if (BindUtils.is_binding_endpoint(options)) {
      if (endpoint_binder) {
        Server.setBinderMethod(endpoint_binder, options.method, options.handler);
      }
      else {
        const new_binder = {
          path: options.path,
          method_handlers: BindUtils.create_nonstatic_binder_methods()
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

  private addBinder<T extends Internal.Binder>(
    binder: T,
    binder_has_error_middleware: T extends Internal.MiddlewareBinder ? boolean : false = false
  ): void | never {
    if (binder_has_error_middleware && predicates.is_middleware_binder(binder)) {
      this.error_middleware_binders.add(binder);
    }
    else if (predicates.is_middleware_binder(binder)) {
      this.binders.add(binder);
    }
    else if (predicates.is_endpoint_binder(binder) || predicates.is_static_binder(binder)) {
      this.binders.add(binder);
    } else {
      const exhaustiveCheck: never = binder;
      throw new Error(`Runtime binder type checking failed: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  private static setBinderMethod<T extends Internal.EndpointBinder>(
    binder: T,
    method: Internal.EndpointMethod,
    handler: T extends Internal.EndpointBinder<"static"> ? Response : EndpointHandler): void | never {
    if (predicates.is_static_binder(binder)) {
      predicates.predicative_assert(handler, "Handler was expected to be a response", predicates.is_response);
      binder.method_handlers[method] = handler;
    }
    else if (predicates.is_endpoint_binder(binder)) {
      predicates.predicative_assert(
        handler,
        "Handler was expected to be a endpoint binder handler",
        (d): d is EndpointHandler => {
          return !predicates.is_response(d);
        });
      binder.method_handlers[method] = handler;
    }
    else {
      const exhaustiveCheck: never = binder;
      throw new Error(`Mismatch in binder type (static or non-static) and binder handler : ${JSON.stringify(exhaustiveCheck)}`);
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

    // Just prints defined binders in order to verify if they are configured whithin the binders array
    Bun.serve({
      port,
      fetch(req) {
        try {
          // May lead to run time type checking error

          const main_chain_response = binders.responseFromChain({
            req, step_behaviour: "next_chain"
          })
          if (main_chain_response)
            return main_chain_response;

          const err_mid_chain_response = error_middleware_binders.responseFromChain({
            req, step_behaviour: "next_binder"
          })
          if (err_mid_chain_response)
            return err_mid_chain_response;

          throw new Error(`Unhandeled http request : ${req.url}`)
        } catch (error) {
          // In either case, the server is wrongly configured and the program necessarily have to crash

          console.error(error);
          process.exit(1);
        }
      }
    });

    callback ? callback() : undefined;
  }
}


export class Server extends ServerBase {
  // TODO: Allow async method_handlers / middleware_handlers

  /// @brief Supports static responses system (built atop bun's static responses)
  public get(
    path: string,
    handler: Internal.GetHandlerKind<Internal.EndpointBinder>): void | never {
    // Helps TS to find the sign overload
    if (predicates.is_response(handler)) {
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
    handler: Internal.GetHandlerKind<Internal.EndpointBinder>): void | never {
    // Helps TS to find the sign overload
    if (predicates.is_response(handler)) {
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
    handler: Internal.GetHandlerKind<Internal.EndpointBinder>): void | never {
    // Helps TS to find the sign overload
    if (predicates.is_response(handler)) {
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

  // TODO: Finish remaining http methods

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
}