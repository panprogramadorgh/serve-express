"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Endpoint = void 0;
var Endpoint;
(function (Endpoint) {
    let Methods;
    (function (Methods) {
        Methods[Methods["GET"] = 1] = "GET";
        Methods[Methods["POST"] = 2] = "POST";
        Methods[Methods["PATCH"] = 3] = "PATCH";
        Methods[Methods["DELETE"] = 4] = "DELETE";
    })(Methods = Endpoint.Methods || (Endpoint.Methods = {}));
    Endpoint.stringToMethod = {
        "GET": Methods.GET,
        "POST": Methods.POST,
        "PATCH": Methods.PATCH,
        "DELETE": Methods.DELETE
    };
    Endpoint.middlewareHandler = Methods.DELETE + 1;
    /// @brief Creates binder and thus its first handler
    function createBinder(path, method, handler) {
        const binderHandlers = {};
        binderHandlers[method] = handler;
        return { path, handlers: binderHandlers };
    }
    Endpoint.createBinder = createBinder;
    function addBinderHandler(binder, method, handler) {
        binder.handlers[method] = handler;
        return binder;
    }
    Endpoint.addBinderHandler = addBinderHandler;
})(Endpoint || (exports.Endpoint = Endpoint = {}));
