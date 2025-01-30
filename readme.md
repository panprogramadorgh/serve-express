# ServeExpress

## Get Started 🚀

ServeExpress is an easy to use declarative and express like web server programming interface built atop the fast Bun.serve API from Bun runtime.

ServeExpress provides a similar interface to experss and at the same time, includes all the benefits from Bun.serve API. This means we have :
- Static routes (see [official bun's docs](https://bun.sh/docs/api/http#static-routes))

- Response on return (avoiding [http response splitting](https://en.wikipedia.org/wiki/HTTP_response_splitting))

- Response streaming (not implemented yet)

- Fetch API Request, Response and Headers based workflow

- 2.5x times faster responses (see [bun's Bun.serve API official benchmarks](https://bun.sh/docs/api/http#benchmarks))

- Typescript support

Here a brief example of a very basic application that attends get http requests targeted to home page. In this particular case we are defining GET:/ to respond statically, this means we dont' loose performance creating our Response instance for every http attended response, in fact, the response is just instanciated onces when running the application in the very first secconds.  We have algo defined a middleware to be executed just before the get method, so for every GET:/ request we will see printed at screen the value for auth header.

```ts
import { Server } from "serve-express";

const server = new Server();

server.use("/", (req, next, ctx) => {
  const { headers } = req;
  console.log(headers.get("auth"));
  return next();
});

server.get("/", Response.json({ message: "hello world" }));

const port = Number(process.env["PORT"]) ?? 8080;
server.listen(port, () => {
  console.log("Server running at", `http://localhost:${port}`)
})
```

> Since bun's runtime automatically retrieves environment variables from .env at the root of the project, we don't care about using packages like `dotenv`. More information about how Bun handles environment variables [here](https://bun.sh/docs/runtime/env).

We can also define middleware to be marked as "error middleware" (similar to express error middlewares).

> To mark middleware as "error middleware" we have to pass third boolean argument to `Server.prototype.use()`

```ts
server.use("/home", (req, next, ctx) => {
  return Response.json({ error_stack: ctx.error_stack });
}, true); // <-- An error middleware it's been defined
```

### Differences between express and serve-express next callback function APIs

For every error middleware we've define (always keeping in mind what order do we have used when defining them), we will create an "error middleware chain". When entering into the error middleware chain (we always enter by the first error middleware defined), we only have two possibilities:

	1. Step to next error middleware, or;
	2. Return a response
	
We should always keep in mind that atleast one of the error middleware binders we've define should be returning a response, otherwise the server will send a placeholder error response.

[placeholder error response](https://github.com/panprogramadorgh/serve-express/tree/main/node_modules/serve-express/imgs/client-response-was-not-processed.png "placeholder error response")

Just as express behaves, we enter in error middleware chain when calling the next callback funcion with an error as argument (unlike to express, serve-express just admits an string as a right value for next callback).

If we call the next callback function without any argument, serve-express will step to next middleware (or the final endpoint). We gain access to next callback function within a middleware, either it is error middleware or standard middleware (however it doesn't behave the same sinces if we call next with some errror value and we are already inside the error middleware chain, we will be just pushing a new error message to the error messages stack)

For every error value as argument in next call, the error message will be pushed to the error messages stack.

```ts
import { Server } from "serve-express"

const server = new Server();

server.use("/home", function (req, next) {
	const { headers } = req;
	const auth = headers.get("auth");
	if (!auth)
		return next("Try harder 🧨"); // Enters in error middleware for /home
	return next(); // Steps to GET:/home
});

server.get("/home",
	Response.json({
		message: "You are in home page 🏠 !"
	}, { status: 200 }));

server.use("/home", function (req, next, ctx) {
	return Response.json({error_stack: ctx.error_stack})
}, true) // <-- An error middleware it's been defined

const port = Number(process.env.PORT) ?? 8080;
server.listen(port, () => {
	console.log("Server listening on", port);
});
```

### The binding context

If you have been paying attention, either in endpoint or middleware binder handlers, we have an extra argument called context. The propose of this argument is emit shared information across all binder handlers. This way, for example, we can easily acess the error messages stack or we can even write / read our own data in ctx.data object and all changes made on it will be visible by other binder methods.

Picking user-defined information from ctx.data in context:

```ts
server.get("/", (req, ctx) => {
  return Response.json({ message: `Hi there ${ctx.data.user.uname} !` }, { status: 200 });
});
```

> Note: the error messages stack is found at the same level than data within ctx since it isn't user-defined information but internal API informacion it provides out of the box for binders.

```ts
server.use("/", (req, next, ctx) => {
  return Response.json({ error_stack: ctx.error_stack });
}, true); // <-- An error middleware it's been defined
```

The ctx.data object is typed with an interface called `BindContextData`, meaning we may merge it in order to let ctx.data atopt a determinated shape and thus, gain safetely typed reads / writes inside.

```ts
import { Server } from "serve-express";

declare module "serve-express" {
  interface BindContextData {
    user: {
      uid: string;
      uname: string;
      utype: Utype;
    }
  }
}

// Utilities ---------------
type Utype = "admin" | "unprivileged";

function is_utype(utype: unknown): utype is Utype {
  if (typeof utype != "string")
    return false;
  return utype == "admin" || utype == "unprivileged";
}
// ------------------------

const server = new Server();

// No ejecuta middleware
server.use("/", function (req, next, ctx) {
  const { headers } = req;
  const uid = headers.get("uid");
  const uname = headers.get("uname");
  const utype = headers.get("utype");

  if (!uid || uid.trim().length == 0)
    return next(`Value of 'uid' header is invalid : ${uid}`);
  else if (!uname || uname.trim().length == 0)
    return next(`Value of 'uname' header is invalid : ${uname}`);
  if (!is_utype(utype))
    return next(`Value of 'utype' header is invalid : ${utype}`);

  // Writes in context, acording to BindContextData interface
  ctx.data.user = { uid, uname, utype }

  return next();
});

server.get("/", (req, ctx) => {
  return Response.json({ message: `Hi there ${ctx.data.user.uname} !` }, { status: 200 });
});

server.use("/", (req, next, ctx) => {
  console.log("Simple test error middleware");

  // return next(`We can also push
  // messages onces we are inside
  // err mid chain`);

  return next();
}, true);

server.use("/", (req, next, ctx) => {
  return Response.json({ error_stack: ctx.error_stack });
}, true); // <-- An error middleware it's been defined

const port = Number(process.env.PORT) ?? 8080;
server.listen(port, () => {
  console.log("Server listening on", port);
});
```

...
