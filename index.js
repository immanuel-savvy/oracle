import Repos from "@godprotocol/repositories";
import Oracle from "./Oracle.js";

let mirror = new Repos();

let oracle = new Oracle(mirror);

export default oracle.sync;
export { oracle };
