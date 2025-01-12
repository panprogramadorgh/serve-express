"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickHTTP = void 0;
const http = __importStar(require("node:http"));
const endpoint_1 = require("endpoint");
const response_wrapper_1 = require("response-wrapper");
class QuickHTTP {
    binders = [];
    get(path, handler) {
        for (const binder of this.binders) {
            if (binder.path != path)
                continue;
            return endpoint_1.Endpoint.addBinderHandler(binder, endpoint_1.Endpoint.Methods.GET, handler);
        }
        const binder = endpoint_1.Endpoint.createBinder(path, endpoint_1.Endpoint.Methods.GET, handler);
        this.binders.push(binder);
        return binder;
    }
    post(path, handler) {
        for (const binder of this.binders) {
            if (binder.path != path)
                continue;
            return endpoint_1.Endpoint.addBinderHandler(binder, endpoint_1.Endpoint.Methods.POST, handler);
        }
        const binder = endpoint_1.Endpoint.createBinder(path, endpoint_1.Endpoint.Methods.POST, handler);
        this.binders.push(binder);
        return binder;
    }
    /*
    public use<M extends Endpoint.Methods = Endpoint.Methods>(path: string, handler: Endpoint.MidHandler): Endpoint.Binder<Endpoint.Handler, M> {
      for (const binder of this.binders) {
        if (binder.path != path)
          continue;
        // TODO: Terminar
        // binder.handlers[Endpoint.middlewareHandler]
      }
      const binder = Endpoint.createBinder<Endpoint.Handler, Endpoint.Methods>(path, Endpoint.Methods.POST, handler);
      this.binders.push(binder);
      return binder;
    }
    */
    listen(port, callback) {
        const server = http.createServer((req, res) => {
            for (const binder of this.binders) {
                if (req.url != binder.path)
                    continue;
                // Method verification
                const method = req.method != undefined && endpoint_1.Endpoint.stringToMethod[req.method];
                if (!method || !binder.handlers[method]) {
                    res.statusCode = 400;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ error: "Unsopported method" }));
                    return;
                }
                // Calls the correspondig handler
                binder.handlers[method](req, new response_wrapper_1.ResponseWrapper(res));
            }
        });
        server.listen(port, callback);
    }
}
exports.QuickHTTP = QuickHTTP;
