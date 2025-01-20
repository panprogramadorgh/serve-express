import { ServeExpress } from "index";

const server = new ServeExpress.Server();

server.get("/", Response.json({ message: "hello world" }, { status: 200 }));

server.listen(3000, () => {
  console.log("Server listening on 3000");
})