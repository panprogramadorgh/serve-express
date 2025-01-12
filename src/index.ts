import { QuickHTTP } from "./interface/core";

const app = new QuickHTTP();

app.get("/", (req, res) => {
  return res.status(200).json({ message: req.url });
})

app.post("/home", (req, res) => {
  return res.status(200).json({ message: "hello world" });
})

app.listen(3000, () => {
  console.log("Listening on 3000");
});