import Repos from "@godprotocol/repositories";
import Oracle from "./Oracle.js";

import dotenv from "dotenv";
dotenv.config();

let oracle_server = {
  hostname: process.env.VERCEL ? "godprotocol-oracle.vercel.app" : "127.0.0.1",
};
if (!process.env.VERCEL) {
  oracle_server.port = process.env.PORT;
}

let mirror = new Repos();
mirror = await mirror.cloth_repo({
  type: "github",
  options: {
    key: process.env.GITHUB_TOKEN,
    username: "immanuel-savvy",
    repo: "Immanuel",
  },
});

let oracle = new Oracle(oracle_server, mirror);

export default await oracle.sync();
export { oracle };
