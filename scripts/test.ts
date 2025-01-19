import { ServeExpress } from "core";

const app = new ServeExpress.Server();

app.get("/", () => Response.json({ data: "message" }, { status: 200 }));

app.listen(3000, () => {
  console.log("Server listening on 3000");
});
