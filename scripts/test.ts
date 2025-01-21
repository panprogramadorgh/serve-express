import { Server } from "index";

const server = new Server();

// FIXME: Inferencia de tipos
server.use("/", (req, next) => {
  return new Response();
})

server.get("/", Response.json({ message: "hello world" }, { status: 200 }));

server.listen(3000, () => {
  console.log("Server listening on 3000");
})