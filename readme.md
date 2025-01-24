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

Here a brief example of how it works. In this example we illustrate how we may define multiple middleware and then a final and static response.

```ts
import { Server } from "serve-express"

const server = new Server();

server.use("/home", function (req, next) {
	const { headers } = req;
	const auth = headers.get("auth");
	if (!auth)
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	return next();
});

server.use("/home", function (req, next) {
	console.log("Hello from middleware little stinky poop 😀 !");
	return next();
})

server.get("/home", Response.json({ message: "You are in home page 🏠 !" }, { status: 200 }));

const port = Number(process.env.PORT) ?? 8080;
server.listen(port, () => {
	console.log("Server listening on", port);
});
```

> Since bun's runtime automatically retrieves environment variables from .env at the root of the project, we don't care about using packages like `dotenv`. More information about how Bun handles environment variables [here](https://bun.sh/docs/runtime/env).
