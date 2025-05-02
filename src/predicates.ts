/**
 * This module provides all type predicates / utility type predicates of the project.
 * Allows narrowing or/and item filtering, finding, assert, etc.
 * Works closely over the internal type definitions of the project.
 */

// TODO: Secure this whole bunch of predicates in sake of safe data typing

// FIXME: Fix al type problems related with type predicates in ./core.ts

import { AssertionError } from "node:assert"
import { Internal } from "./definitions"

// Utility type predicates ---------------

/**
 * Generates a filtered copy of an array and narrows it's type
 * @param array Any array of any type
 * @param predicate Type predicate callback in charge of fiiltering the array items
 */
export function predicative_filter<T, U>(
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
export function predicative_find<T, U>(
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
export function typed_assert<T = true>(data: unknown, message: string, predicate: (d: unknown) => d is T = (d): d is T => d == true): asserts data is T {
  if (!predicate(data))
    throw new AssertionError({ message });
}

// Only type checking type predicates

/**
 * Predicates whether if `supposted_method` is whether or not of EndpointMethod type
 * @param supposted_method Is fully secure passing any type to this parameter
 * @returns Boolean as a type predicate
 */
export function is_endpoint_method(supposted_method: unknown): supposted_method is Internal.EndpointMethod {
  if (typeof supposted_method != "string")
    return false;
  for (const method_name of Internal.endpoint_methods) {
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
export function is_binder(binder: unknown): binder is Internal.Binder {
  if (typeof binder != "object" || binder == null)
    return false;
  if (!("path" in binder) || typeof binder.path != "string")
    return false;

  if ("req_handlers" in binder && typeof binder.req_handlers == "object" && binder.req_handlers != null) {
    for (const method of Internal.endpoint_methods) {
      if (!(method in binder.req_handlers))
        return false;

      const req_handler = (binder.req_handlers as any)[method]
      if (typeof req_handler != "function" && !is_response(req_handler) || req_handler != null)
        return false;
    }
  } else if ("mid_req_handler" in binder && typeof binder.mid_req_handler == "function") {
    ;
  } else {
    return false;
  }

  return true;
}

/**
 * predicates whether if binder is binder<"endpoint"> type
 * @param binder any variable of any type
 * @returns boolean as a type predicate
 */
export function is_endpoint_binder(binder: unknown): binder is Internal.EndpointBinder {
  if (!is_binder(binder))
    return false;
  if (!("req_handlers" in binder))
    return false;
  if (typeof binder.req_handlers != "object" || binder.req_handlers == null)
    return false;

  // Ensures binder uses all methods
  const binder_endp_methods = Object.keys(binder.req_handlers);
  for (const method of Internal.endpoint_methods) {
    if (!(method in binder_endp_methods))
      return false;
  }
  return true;
}

/**
 * predicates whether if binder is binder<"endpoint"> type
 * @param binder any variable of any type
 * @returns boolean as a type predicate
 */
export function is_nonstatic_binder(binder: unknown): binder is Internal.EndpointBinder<"non-static"> {
  if (!is_endpoint_binder(binder))
    return false;

  // Ensures all request handlers are callbacks instead of responses objects
  const binder_req_handlers = Object.values(binder.req_handlers);
  for (const req_handler of binder_req_handlers) {
    if (typeof req_handler != "function" && req_handler != null)
      return false;
  }

  return true;
}

/**
 * Whether if binder is Binder<"endpoint", "static"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_static_binder(binder: unknown): binder is Internal.EndpointBinder<"static"> {
  if (!is_endpoint_binder(binder))
    return false;

  // Ensures all request handlers are callbacks instead of responses objects
  const binder_req_handlers = Object.values(binder.req_handlers);
  for (const req_handler of binder_req_handlers) {
    if (!is_response(req_handler))
      return false;
  }

  return true;
}

/**
 * Predicates whether if binder is Binder<"endpoint"> type
 * @param binder Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_middleware_binder(binder: unknown): binder is Internal.MiddlewareBinder {
  if (!is_binder(binder))
    return false;
  if (!("mid_req_handler" in binder))
    return false;
  return typeof binder.mid_req_handler == "function";
}

/**
 * Predicates whether if response is a fetch API reponse interface or not
 * @param response Any variable of any type
 * @returns Boolean as a type predicate
 */
export function is_response(response: unknown): response is Response {
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
export function is_middleware_next_return(middleware_return: unknown):
  middleware_return is ReturnType<Internal.MiddlewareNext> {
  if (typeof middleware_return != "object" || middleware_return == null)
    return false;
  if (is_response(middleware_return))
    return false;
  return "error_stack_piece" in middleware_return;
}
