import { Internal } from "../definitions"
import * as predicates from "../predicates"

/* ServerBase's bind method utils. */

/**
 * Used as a bind method parameter and privides an easy to use way of setting / addming a new binder to the specific server instance.
 */
export type BindOptions<T extends Internal.Binder> =
  (T extends Internal.EndpointBinder ?
    {
      method: Internal.EndpointMethod;
    } : {
      err_mid: boolean; // is_error_middleware
    }) & {
      path: string;
      // Does not make any sense to bind null handlers
      req_handler: Exclude<Internal.GetHandlerKind<T>, null>
    };

/* Bind related utility functions */

/**
 * @returns Initialized req_handlers from an `EndpointBinder` data type object
 */
export function init_handlers() {
  return Internal.endpoint_methods.reduce<Record<Internal.EndpointMethod, null>>((acc, method) => {
    acc[method] = null;
    return acc;
  }, {} as any)
}

/* Bind related type predicates */

/**
 * Predicates whether if bind_options argument is BindOptions<Internal.EndpointBinder> type
 * @param bind_options Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_binding_endpoint(bind_options: unknown): bind_options is BindOptions<Internal.EndpointBinder> {
  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "method"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("req_handler" in bind_options))
    return false;
  return true;
}

/**
 * Predicates whether if bind_options argument is BindOptions<Internal.EndpointBinder<"non-static">> type
 * @param bind_options Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_binding_nonstatic(bind_options: unknown):
  bind_options is BindOptions<Internal.EndpointBinder<"non-static">> {
  if (!is_binding_endpoint(bind_options))
    return false;
  return typeof bind_options.req_handler == "function";
}

/**
 * Predicates whether if bind_options argument is BindOptions<Internal.EndpointBinder<"static">> type
 * @param bind_options Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_binding_static(bind_options: unknown):
  bind_options is BindOptions<Internal.EndpointBinder<"static">> {
  if (!is_binding_endpoint(bind_options))
    return false;
  return predicates.is_response(bind_options.req_handler);
}

/**
 * predicates whether if bind_options is bindoptions<binder<"middleware">>
 * @param bind_options any variable of any type
 * @returns boolean as a type predicate
 */
export function is_binding_middleware(bind_options: unknown):
  bind_options is BindOptions<Internal.MiddlewareBinder> {
  if (typeof bind_options != "object" || bind_options == null)
    return false;
  const required_props = ["path", "err_mid"];
  for (const prop of required_props) {
    if (!(prop in bind_options))
      return false;
  }
  if (!("handler" in bind_options))
    return false;
  return typeof bind_options.handler == "function";
}