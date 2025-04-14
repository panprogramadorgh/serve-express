/**
 * This file contains all the generic type definitions used either by the API consumer or by the internal implementation.
 */

/**
 * Internal implementation's type definitions
 */
namespace Internal {
  /**
   * Allowed http request methods
   */
  const endpoint_methods = ["get", "post", "patch", "delete"] as const;
  export type EndpointMethod = typeof endpoint_methods[number];

  /**
   * Callback provided in middleware handler binders
   * @param message When isn't an empty string, will push into the error_stack prop inside the binder context (which is accesible for any kind of binder method). Then the error middleware chain will start executing at the error middleware in head.
   */
  export type MiddlewareNext =
    ((message?: string) => { error_stack_piece: string | undefined })

  /**
   * Allows inter handler (either endpoint or middleware) communication. Bind context object is common for al handlers and is accesible from the binder method / handler_methos
   */
  export type BindContext = {
    /**
     * Includes all error messages were generated in that particular BinderChain
     */
    readonly error_stack: string[],

    /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
    readonly data: BindContextData,
  }

  /* Binder type definitions */

  /**
   * Sets whether binder is endpoint or middleware kind
   */
  const binder_kinds = ["endpoint", "middlware"] as const;
  export type BinderKind = typeof binder_kinds[number]

  /**
   * Sets whether the endpoint binder uses handler endpoint functions or static generated responses.
   */
  const endpoint_kinds = ["non-static", "static"] as const;
  export type EndpointKind = typeof endpoint_kinds[number];

  /**
   * Generic for all kind of endpoint binders
   */
  export type EndpointBinder<T extends EndpointKind = EndpointKind> =
    {
      path: string;
      method_handlers: Record<EndpointMethod, T extends "static" ? Response : EndpointHandler>;
    }

  /**
   * The only possibe middleware binder type
   */
  export type MiddlewareBinder =
    {
      path: string;
      middleware_handler: MiddlewareHandler;
    }

  /**
   * Generic that bundles all variants of binder type
   */
  export type Binder<T extends BinderKind = Binderkind, U extends EndpointKind = EndpointKind> =
    T extends "endpoint" ? EndpointBinder<U> : MiddlewareBinder

  /**
   * Helps getting the appropiated handler type for all kind of binders
   */
  export type GetHandlerKind<T extends Binder> =
    T extends EndpointBinder ?
    (EndpointBinder["method_handlers"][EndpointMethod]) :
    MiddlewareBinder["middleware_handler"]
}

/**
 * Both internal implementation and API consumer general purpuse type definitions 
 */
declare global {

  /* Global constants */
  const error_middleware = true;

  /**
   * Type used inside non-static method_handlers binder
   */
  type EndpointHandler = (req: Request, context: BindContext) => Response;

  /**
   * Middleware binder handler. We use the same type of callbacks for standard middlewares and error middlewares, since both can the access the error stack inside context as given function parameter.
   * @param req Represents the incoming http request as a fetch API Response interface
   * @param next Next callback controls whether we step over the next middleware / final endpoint or we just enter into the error middleware chain
   */
  type MiddlewareHandler = (req: Request, next: Internal.MiddlewareNext, context: BindContext) =>
    Response | ReturnType<Internal.MiddlewareNext>;

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

  interface BindContextData { }

}

export { Internal };