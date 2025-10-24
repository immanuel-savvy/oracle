# 🧠 @godprotocol/oracle

**A distributed coordination server for decentralized repositories.**  
The Oracle module in the God Protocol framework synchronizes data, repositories, and content across network nodes — ensuring consistency, resilience, and real-time scalability across thousands of distributed systems.

---

## 🚀 Features

- ⚙️ **Repository Synchronization:** Automatically sync repositories across mirrors and servers.
- 🪞 **Mirror-Aware Architecture:** Keeps lightweight cache and propagation queues for mirrored nodes only.
- 🧩 **Bulk Operations:** Optimized `write_bulk()` API for fast multi-file commits.
- 🌍 **Horizontal Scalability:** Supports thousands of servers through Oracle Clients and async propagation queues.
- 🔐 **Authentication Layer:** Token-based client identification and authorization.
- 🔁 **Self-Propagating Network:** Oracles automatically sync peers and push updates to connected servers.

---

## 📦 Installation

```bash
📦 Installation
npm install @godprotocol/oracle

🧩 Quick Start
import sync from "@godprotocol/oracle/index.js";
import {repo_config} from "./repos.js"

let server_details =  {
    hostname: process.env.HOSTNAME,
    port: process.env.PORT
  }

sync(server_details, repo,
).then((handler) => {
const http = require("http");

http.createServer(handler).listen(server_details.port, () => {
console.log(`Oracle server running at http://${server_details.hostname}:${server_details.port}`);
});
});

⚙️ API Reference
Class: Oracle
constructor(mirror)

Initializes an Oracle instance with a mirror repository for coordination.

oracle.sync(server, mirror)

Starts synchronization and returns a Node.js-compatible HTTP handler.

oracle.authenticate({ client })

Registers and authenticates a client node.

oracle.add_repo({ filter, repo }, { client })

Adds a new repository with an optional filter (e.g., regex for content paths).

oracle.write({ path, content }, client)

Writes content to one or more matching repositories and propagates updates across mirrors.

oracle.write_bulk(contents, client)

Writes multiple files efficiently in a single operation.

oracle.read(path)

Reads content from distributed repositories, returning both data and its source repo.

oracle.propagate(payload, callback?)

Propagates data or sync signals across all registered servers.

🖧 Network Design

The Oracle is designed for non-blocking distributed propagation.
When a write or repo sync occurs:

The Oracle immediately acknowledges the client.

It then asynchronously propagates updates across mirrors and peer Oracles using the queued propagation system.

Mirrors cache only content location metadata (not full data) to prevent stale reads.

This ensures fast request–response cycles and consistent eventual synchronization across the network.

📡 Example: Oracle Client

Clients communicate with Oracle servers via a simple JSON-based POST interface.

import OracleClient from "@godprotocol/framework/oracle_client.js";

const oracle = new OracleClient({ hostname: "localhost", port: 5050 });

await oracle.sync({ hostname: "app-node", port: 3000 });
await oracle.write("data/record.json", { id: 1, name: "John Doe" });

const data = await oracle.read("data/record.json");
console.log(data);

🧱 Project Structure
@/godprotocol/oracle
│
├── Oracle.js # Main Oracle class
├── server.js # HTTP server routes and request handler
├── index.js # Default export and bootstrap
└── package.json

🔗 Related Packages
Package Description
@godprotocol/repositories
Repository management and file abstractions
godprotocol
Core framework orchestrating decentralized computation
generalised-datastore
Data storage and remote access integration layer
📜 License

MIT © Savvy
```
