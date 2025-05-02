/**
 * Provides the api consumer the Server class to configure and quickly raise the http server.
 */

import BinderChain from "./binder/binder-chain"
import * as predicates from "./predicates"
import * as bindutils from "./binder/binder-utils"
import { ServerConfigError } from "./errors"
import { Internal } from "./definitions"

/* ServerBase implementation follows */

/**
 * Contains all the low level logic of this programming interface.
 * - HTTP raw resource binding, and
 * - BinderChain handling utilities
 */
class ServerBase {
  /* server's binder chains */
  private binders = new BinderChain<Internal.Binder>(); // endpoints + middleware
  private err_middleware = new BinderChain<Internal.MiddlewareBinder>(); // error middleware

  /**
   * Generic bind method allows new bind entries to be added whithin any their corresponding binder chain 
   * @param options Configures how will the new binder be.
   * @returns void
   * @throws Might throw an excepcion if bad configuration is provided.
   */
  public bind(options: bindutils.BindOptions<Internal.Binder>): void | never {

    // Middleware binder handler binding
    if (bindutils.is_binding_middleware(options)) {
      const some_binder = { path: options.path, mid_req_handler: options.req_handler }
      this.pushNewBinder(some_binder, options.err_mid);
    }

    // Endpoint binder handler binding
    else if (bindutils.is_binding_endpoint(options)) {
      // Searches for latest ocurrence of matching path endpoint binder (either static or not).
      const last_nonstatic = this.binders.getTail(options.path, predicates.is_nonstatic_binder);
      const last_static = this.binders.getTail(options.path, predicates.is_static_binder);
      const endpoint_binder = last_static ?? last_nonstatic;

      // Some new binder is created
      let some_binder = endpoint_binder ?? {
        path: options.path,
        req_handlers: bindutils.init_handlers()
      } satisfies Internal.EndpointBinder;
      some_binder.req_handlers[options.method] = options.req_handler;
      if (!endpoint_binder)
        this.pushNewBinder(some_binder);
    }

    // Bad configuration were provided as part of `options`
    else {
      throw new ServerConfigError(`Bind method runtime type checking error. Invalid 'options' were provided: ${JSON.stringify(options)}`);
    }
  }

  /**
   * Given the binder that is provided, it is type narrowed and pushed to its corresponding BinderChain.
   * @param binder Any type of binder.
   * @param err_mid_binder Whether binder is an error middleware
   * @returns void
   * @throws Might throw an excepcion if an invalid binder is provided as argument.
   */
  private pushNewBinder<T extends Internal.Binder>(
    binder: T,
    err_mid_binder: T extends Internal.MiddlewareBinder ? boolean : false = false
  ) {
    if (err_mid_binder && predicates.is_middleware_binder(binder)) {
      this.err_middleware.add(binder);
    } else if (predicates.is_middleware_binder(binder)) {
      this.binders.add(binder);
    } else if (predicates.is_endpoint_binder(binder)) {
      this.binders.add(binder)
    } else {
      const exhaustiveCheck: never = binder;
      throw new TypeError(`Cannot push invalid binder: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }

  /**
   * After all handlers and middleware (binders) are configured, `listen` raises the http server on `port`.
   * @param port The http port (i.e 80, 3000 or 8080)
   * @param callback If neither of the server configuration methods throws an exception (the server is correctly configured), callback is executed.
   */
  public listen(port: number, callback?: () => void): void {
    // Acceso a miembros de clase desde fetch
    const { binders, err_middleware } = this;

    Bun.serve({
      port,
      fetch(req) {
        try {
          // May lead to runtime type checking error

          const main_chain_response = binders.responseFromChain({
            req, next_cb_behaviour: "chain_ahead"
          })
          if (main_chain_response)
            return main_chain_response;

          const err_mid_chain_response = err_middleware.responseFromChain({
            req, next_cb_behaviour: "binder_ahead"
          })
          if (err_mid_chain_response)
            return err_mid_chain_response;

          throw new ServerConfigError(`Unhandeled http request : ${req.url}`)
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
  // TODO: Document methods and specify wether they throw or not exceptions

  /// @brief Supports static responses system (built atop bun's static responses)
  public get(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "get",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public post(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "post",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public put(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "put",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public delete(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "delete",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public patch(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "patch",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public head(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "head",
      req_handler
    });
  }

  /// @brief supports static responses system (built atop bun's static responses)
  public options(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "options",
      req_handler
    });
  }

  /// @brief supports static responses system (built atop bun's static responses)
  public trace(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "trace",
      req_handler
    });
  }

  /// @brief supports static responses system (built atop bun's static responses)
  public connect(
    path: string,
    req_handler: Exclude<Internal.GetHandlerKind<Internal.EndpointBinder>, null>): void | never {
    return this.bind({
      path,
      method: "connect",
      req_handler
    });
  }

  /// @brief Supports static responses system (built atop bun's static responses)
  public use(
    path: string,
    mid_req_handler: MiddlewareHandler,
    err_mid: boolean = false) {
    return this.bind({
      path,
      req_handler: mid_req_handler,
      err_mid
    });
  }
}