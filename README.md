# 🧠 @godprotocol/oracle

**A distributed coordination server for decentralized repositories.**

The Oracle module in the God Protocol framework ensures seamless synchronization of data, repositories, and content across network nodes, delivering consistency, resilience, and real-time scalability for thousands of distributed systems.

---

## 🚀 Features

- **⚙️ Repository Synchronization**: Automatically syncs repositories across mirrors and servers.
- **🪞 Mirror-Aware Architecture**: Maintains lightweight cache and propagation queues for mirrored nodes.
- **🌍 Horizontal Scalability**: Supports thousands of servers via Oracle Clients and async propagation queues.
- **🔐 Authentication Layer**: Token-based client identification and authorization.
- **🔁 Self-Propagating Network**: Oracles automatically sync peers and push updates to connected servers.

---

## 📦 Installation

Install the Oracle module using npm:

```bash
npm install @godprotocol/oracle
```

---

## 🧩 Quick Start

Set up an Oracle server with the following example:

```javascript
import sync from "@godprotocol/oracle/index.js";
import { repo_config } from "./repos.js";

const server_details = {
  hostname: process.env.HOSTNAME || "localhost",
  port: process.env.PORT || 8080,
};

sync(server_details, repo_config).then((handler) => {
  const http = require("http");
  http.createServer(handler).listen(server_details.port, () => {
    console.log(
      `Oracle server running at http://${server_details.hostname}:${server_details.port}`
    );
  });
});
```

---

## ⚙️ API Reference

### **Class: Oracle**

| Method                                          | Description                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `constructor(mirror)`                           | Initializes an Oracle instance with a mirror repository for coordination.                  |
| `oracle.sync(server, mirror)`                   | Starts synchronization and returns a Node.js-compatible HTTP handler.                      |
| `oracle.authenticate({ client })`               | Registers and authenticates a client node.                                                 |
| `oracle.add_repo({ filter, repo }, { client })` | Adds a new repository with an optional filter (e.g., regex for content paths).             |
| `oracle.write({ path, content }, client)`       | Writes content to one or more matching repositories and propagates updates across mirrors. |
| `oracle.write_bulk(contents, client)`           | Writes multiple files efficiently in a single operation.                                   |
| `oracle.read(path)`                             | Reads content from distributed repositories, returning both data and its source repo.      |
| `oracle.propagate(payload, callback?)`          | Propagates data or sync signals across all registered servers.                             |

### **🧩 HTTP Endpoints**

These endpoints are exposed by the Oracle server’s route handler:

| **Endpoint**                    | **Method** | **Description**                                                                                  |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `/`                             | `GET`      | Returns a simple HTML response confirming the Oracle server is active.                           |
| `/oracle/authenticate`          | `POST`     | Registers or authenticates a client. Returns an authorization token.                             |
| `/oracle/read`                  | `POST`     | Reads data from one or more repositories. Requires `Authorization` header.                       |
| `/oracle/write`                 | `POST`     | Writes data to repositories and synchronizes it across mirrors. Requires `Authorization` header. |
| `/oracle/write_bulk`            | `POST`     | Writes multiple data entries in bulk. Requires `Authorization` header.                           |
| `/oracle/add_repo`              | `POST`     | Adds a new repository with a given filter and metadata. Requires `Authorization` header.         |
| `/oracle/on_sync`               | `POST`     | Called when a remote sync event occurs. Used internally for mirror updates.                      |
| `/oracle/sync_repos`            | `POST`     | Synchronizes repository metadata across nodes.                                                   |
| `/oracle/sync_content_location` | `POST`     | Synchronizes specific content location data across mirrors.                                      |

> **Notes:**
>
> - All POST endpoints expect JSON body.
> - Requests to `/oracle/*` (except `/authenticate`) require an `Authorization` header.
> - The server responds with JSON and appropriate HTTP status codes (`200`, `401`, `404`, `500`).

---

## 🖧 Network Design

The Oracle is built for non-blocking distributed propagation. When a write or repository sync occurs:

1. The Oracle immediately acknowledges the client.
2. Updates are asynchronously propagated across mirrors and peer Oracles using a queued propagation system.
3. Mirrors cache only content location metadata (not full data) to prevent stale reads.

This design ensures fast request-response cycles and consistent eventual synchronization across the network.

---

## 📡 Example: Oracle Client

Clients communicate with Oracle servers via a simple JSON-based POST interface:

```javascript
import { repo_any } from "./repos.js";
import { Oracle as OracleClient } from "godprotocol";

const server = { hostname: "server-oracle.app", port: 80 };
const client_details = { hostname: "client-oracle.app", port: 80 };

const oracle = new OracleClient({ server, port: 1909 });
await oracle.sync(client_details, repo_any);

await oracle.add_repo({
  filter: "*",
  repo: repo_any,
});

await oracle.write(
  "data/record.json",
  JSON.stringify({ id: 1, name: "John Doe" })
);

const data = await oracle.read("data/record.json");
console.log(data); // '{"id":1,"name":"John Doe"}'
```

---

## 🔗 Related Packages

| Package                     | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `@godprotocol/repositories` | Repository management and file abstractions      |
| `godprotocol`               | Core framework for decentralized computation     |
| `generalised-datastore`     | Data storage and remote access integration layer |

---

## 📜 License

MIT © Savvy
