import { ServeExpress } from "src/index"

const app = ServeExpress.Server();

app.get("/", (req) => {
  return new Response.json({ message: "hello world" });
})

app.listen(3000, () => {
  console.log("Server listening on 3000");
});
