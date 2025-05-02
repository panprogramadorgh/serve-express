/**
 * This file contains all the generic type definitions used either by the API consumer or by the internal implementation.
 */

/*

# Type narrowing problem identification

Generic types who receive literal string unions as arguments causes the predicates not to work properly. A generic type is ultimately a type union, since all it's arguments and possible combinations of them finish with different ways of resolving the final type.

To solve the problem then, we have to create union types which makes use of that generics in such way they explicitly set all arguments as single values rather than rely on type unions as arguments (literal string type unions in this case).

The generalized error was also caused because the use of type arguments in generic functions / methods.

So in order to correctly type narrow, we can conclude two different things:

  1. Generic types have to be narrowed as much as possible by indicating all their type parameters without making use of type unions.

  2. Type parameters at functions / methods are also related with the problem of type narrow at predicates.

```typescript
type EndpointBinderLike = Internal.EndpointBinder<"static"> | Internal.EndpointBinder<"non-static">

function endpoint_binder_handler(binder: EndpointBinderLike) {
  if (predicates.is_endpoint_binder(binder)) {
    binder // Internal.EndpointBinder<"non-static">
  } else {
    binder // Internal.EndpointBinder<"static">
  }
}
```

Instead of...

```typescript
function endpoint_binder_handler(binder: Internal.EndpointBinder) {
  if (predicates.is_endpoint_binder(binder)) {
    binder // Narrowing error
  } else {
    binder // Narrowing error
  }
}
```

Or event worst...

```typescript
function endpoint_binder_handler<T extends Internal.EndpointBinder>(binder: T) {
  if (predicates.is_endpoint_binder(binder)) {
    binder // Narrowing error
  } else {
    binder // Narrowing error
  }
}
```

// TODO: Check global scoped type definitions system

*/

/**
 * Internal implementation's type definitions
 */
namespace Internal {
  /**
   * Allowed http request methods
   */
  const endpoint_methods = ["get", "post", "put", "delete", "patch", "head", "options", "trace", "connect"] as const;
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
     * // TODO: Enhance error_stack to allow a more sofisticated data type.
     */
    readonly error_stack: string[],

    /* Dinamically maintained by API consumers, which means the user defined binders write and read data from/to it (e. user's session token). It is also user's responsability to merge BindContextData interface for safe type checking. */
    readonly data: BindContextData,
  }

  /* Binder type definitions */

  /**
   * Sets whether the endpoint binder uses handler endpoint functions or static generated responses.
   */
  const endpoint_kinds = ["non-static", "static"] as const;
  export type EndpointKind = typeof endpoint_kinds[number];

  /**
   * Generic for all kind of endpoint binders.
   */
  export type EndpointBinder<T extends EndpointKind = EndpointKind> =
    {
      path: string;
      req_handlers: Record<EndpointMethod, (T extends "static" ? Response : EndpointHandler) | null>;
    }

  /**
   * Union for all kind of endpoint binders. It is preferible to use this type against `EndpointBinder` if there is going to be a narrowing job over it.
   */
  export type EndpointBinderLike = EndpointBinder<"static"> | EndpointBinder<"non-static">

  /**
   * The only possibe middleware binder type
   */
  export type MiddlewareBinder =
    {
      path: string;
      mid_req_handler: MiddlewareHandler;
    }

  /**
   * Union for all kind of binders
   */
  export type Binder = EndpointBinderLike | MiddlewareBinder

  /**
   * Helps getting the suitable handler type for all kind of binders
   */
  export type GetHandlerKind<T extends Binder> =
    T extends EndpointBinder ?
    (EndpointBinder["req_handlers"][EndpointMethod]) :
    MiddlewareBinder["mid_req_handler"]
}

/**
 * Both internal implementation and API consumer general purpuse type definitions 
 */
declare global {
  /**
   * Type used inside non-static method_handlers binder
   */
  type EndpointHandler = (req: Request, context: Internal.BindContext) => Response;

  /**
   * Middleware binder handler. We use the same type of callbacks for standard middlewares and error middlewares, since both can the access the error stack inside context as given function parameter.
   * @param req Represents the incoming http request as a fetch API Response interface
   * @param next Next callback controls whether we step over the next middleware / final endpoint or we just enter into the error middleware chain
   */
  type MiddlewareHandler = (req: Request, next: Internal.MiddlewareNext, context: Internal.BindContext) =>
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