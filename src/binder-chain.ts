/**
 * This module contains a simple interface that stores and manages binders from to which generate http responses
 */

import * as predicates from "./predicates"
import { Internal } from "./definitions"

// TODO: Write some documentation about the class methods

namespace BinderChainUtils {
  /**
   * Used as handleChain parameter.
   */
  export type ResponseFromChainOptions = {
    // The incoming http request
    req: Request;

    /**
     * Sets how we manage `next` callback calls whos message argument is provided.
     * @type next_chain: We halt binder execution and notice method caller to take the next binder chain on.
     * @type next_binder: The `next` callback argument (the error message) is still pushed to `context.error_stack` but the method behaves in a manner it continues with the remaining binders until it finds a response or throw an error if there were not.
     */
    step_behaviour: "next_chain" | "next_binder" // finish
  }


  /** 
   * @returns Returns a new handler context, allowing inter handler comunication
   */
  export function create_bind_context(): Internal.BindContext {
    return {
      error_stack: [],


      /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
      data: {}
    }
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
export default class BinderChain<T extends Internal.Binder = Internal.Binder> {
  private binders: T[] = [];

  constructor(initial_binders?: T[]) {
    if (initial_binders) this.binders.push(...initial_binders);
  }

  public add(binder: T) {
    this.binders.push(binder);
  }

  public getFiltered(path: string) {
    const filtered_binders = predicates.predicative_filter(this.binders, (item): item is T => {
      if (!predicates.is_binder(item))
        return false;

      // TODO: Create complex routing system (currently all lost requests arrive at /)
      // /profile/*             -> /profile/repos, /profile/config
      // /404errorless/pages**  -> /404errorless/pages/test, /404errorless/pages/test/othertest
      return (item.path == "/" && predicates.is_middleware_binder(item)) || item.path == path;
    });

    return filtered_binders;
  }

  public getTail<U extends T>(path: string = "/", predicate: (item: T) => item is U) {
    const last_binder = predicates.predicative_find(
      this.binders.toReversed(),
      (binder): binder is Extract<U, T> => {
        return predicate(binder);
      },
      (binder) => {
        return binder.path == path;
      });
    return last_binder;
  }

  /**
   * Executes all binders in `options.chain` looking for http responses. The kind of binders `options.chain` has is controlled by the generic `U extends BinderChain`
   * @param options HandleChainOptions
   * @returns The response generad by the binder chain or, undefined, if there were not one and thus, there were a middleware binder that made use of `next` callback with some message as argument (whose case next binder chain (AKA error middleware chain) have to take place)
   * @throws An error is thrown either if no responses are generated or no middleware next callback is used with a message as argument -- the server is wrongly configured and it's interface-consumer's responsability to make proper use of it.
   */
  responseFromChain(options: BinderChainUtils.ResponseFromChainOptions): Response | undefined {
    const req_url = new URL(options.req.url);
    const req_method = options.req.method.toLowerCase();
    if (!predicates.is_endpoint_method(req_method))
      return Response.json({ error: "Unsupported request http method." });

    const context = BinderChainUtils.create_bind_context();
    const req_path_binders = this.getFiltered(req_url.pathname);

    for (const binder of req_path_binders) {
      // Middlewares could either return a response or step over the next binder / binder chain
      if (predicates.is_middleware_binder(binder)) {
        let next_callback_was_called = false;
        const mid_return = binder.middleware_handler(options.req, (msg) => {
          next_callback_was_called = true;
          // Run time type checking avoids to push invalid data to contexto error messages stack
          return { error_stack_piece: typeof msg == "string" ? msg : undefined };
        }, context);

        if (predicates.is_response(mid_return)) {
          return mid_return;
        }
        else if (((a): a is ReturnType<Internal.MiddlewareNext> => next_callback_was_called)(mid_return)) {
          const msg = mid_return.error_stack_piece;
          if (!msg) continue;
          context.error_stack.push(msg);

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
      if (predicates.is_response(method_handler))
        return method_handler;

      const generated_response = method_handler(options.req, context);
      // Just in sake of security we run-time-ensure we've got a response to provide
      if (predicates.is_response(generated_response))
        return generated_response;

      throw new Error(`Endpoint response run time type checking error : ${JSON.stringify(generated_response)}`);
    }
  }
}