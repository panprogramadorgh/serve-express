import { Endpoint } from "endpoint";
export declare class QuickHTTP {
    private binders;
    get(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.GET>;
    post(path: string, handler: Endpoint.Handler): Endpoint.Binder<Endpoint.Handler, Endpoint.Methods.POST>;
    listen(port: number, callback?: () => void): void;
}
