import { HandlerResObj } from "../forwarder";

export class ResponseWrapper {
  constructor(public response: HandlerResObj) {
    this.response.setHeader("Content-Type", "application/json");
  }

  /// @brief Sets the Content-Type header
  /// @todo Opto to a more generic aproach (likely setHeaders())
  public contentType(ct: string): void {
    this.response.setHeader("Content-Type", ct);
  }

  /// @brief Sets status code for response
  public status(code: number): ResponseWrapper {
    this.response.statusCode = code;
    return this;
  }

  /// @brief Sends data in json format
  public json(data: any): ResponseWrapper {
    const message = JSON.stringify(data);
    this.response.end(message);
    return this;
  }
}