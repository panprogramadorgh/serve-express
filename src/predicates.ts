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
export function predicative_assert<T = true>(data: unknown, message: string, predicate: (d: unknown) => d is T = (d): d is T => d == true): asserts data is T {
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

  let method_handlers = false;

  // TODO: Improve this type predicate's security. Not only we are basing on the order of a dictionary keys to know wether there are missing methods or not, besides the run time type checkng of the dictionary's values is redundant in its first iteration.

  if (
    ("method_handlers" in binder) &&
    typeof binder.method_handlers == "object" && binder.method_handlers != null &&
    Object.keys(binder.method_handlers).join("") == Internal.endpoint_methods.join("")
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
export function is_endpoint_binder(binder: unknown): binder is Internal.EndpointBinder<"non-static"> {
  if (!is_binder(binder))
    return false;
  if (!("method_handlers" in binder))
    return false;
  if (typeof binder.method_handlers != "object" || binder.method_handlers == null)
    return false;

  // Ensures binder uses all methods (and are static responses)
  const this_binder_methods = Object.keys(binder.method_handlers);
  for (const method of Internal.endpoint_methods) {
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
export function is_static_binder(binder: unknown): binder is Internal.EndpointBinder<"static"> {
  if (!is_binder(binder))
    return false;
  if (!("method_handlers" in binder))
    return false;
  if (typeof binder.method_handlers != "object" || binder.method_handlers == null)
    return false;

  // Ensures binder uses all methods (and are static responses)
  const this_binder_methods = Object.keys(binder.method_handlers);
  for (const method of Internal.endpoint_methods) {
    if (!(this_binder_methods.includes(method)))
      return false;
    const handler = (binder.method_handlers as Record<Internal.EndpointMethod, unknown>)[method]
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
export function is_middleware_binder(binder: unknown): binder is Internal.MiddlewareBinder {
  if (!is_binder(binder))
    return false;
  if (!("middleware_handler" in binder))
    return false;
  return typeof binder.middleware_handler == "function";
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
