export class ServerConfigError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = "ServerConfigError";
  }
}