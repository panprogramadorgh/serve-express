"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseWrapper = void 0;
class ResponseWrapper {
    response;
    constructor(response) {
        this.response = response;
        this.response.setHeader("Content-Type", "application/json");
    }
    /// @brief Sets the Content-Type header
    /// @todo Opto to a more generic aproach (likely setHeaders())
    contentType(ct) {
        this.response.setHeader("Content-Type", ct);
    }
    /// @brief Sets status code for response
    status(code) {
        this.response.statusCode = code;
        return this;
    }
    /// @brief Sends data in json format
    json(data) {
        const message = JSON.stringify(data);
        this.response.end(message);
        return this;
    }
}
exports.ResponseWrapper = ResponseWrapper;
