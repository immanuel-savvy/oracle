import handler from "./index.js";
import http from "http";

let server = http.createServer(handler);
let port = process.env.PORT;

server.listen(port, async () => {
  console.log(`Oracle Server is listening on http://localhost:${port}`);
});
