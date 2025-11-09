const handle_routes = async (req, res, oracle, app) => {
  try {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    // Basic GET route
    if (req.method === "GET") {
      if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(`<h1>Oracle Server Active</h1>`);
      }
      return app ? app(req, res) : res.writeHead(404).end("Not Found");
    }

    // Read POST body safely
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    await new Promise((resolve) => req.on("end", resolve));

    if (!body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Request body cannot be empty" }));
    }

    // Parse body and route call
    const data = JSON.parse(body);
    let result = null;
    let status = 200;

    if (req.url === "/oracle/authenticate") {
      result = await oracle.authenticate(data);
    } else {
      // Always check auth header carefully
      let auth = req.headers.authorization || req.headers.authorisation;
      let client = await oracle.get_client(auth);

      if (!client) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized client" }));
      }

      switch (req.url) {
        case "/oracle/read":
          result = await oracle.read(data.path, data.options, client);
          break;
        case "/oracle/write":
          result = oracle.write(data, client);
          break;
        case "/oracle/write_bulk":
          result = oracle.write_bulk(data.content, client);
          break;
        case "/oracle/add_repo":
          result = oracle.add_repo(data, client);
          break;
        case "/oracle/sync_content_repos":
          result = await oracle.sync_content_repos(data);
          break;
        default:
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid Oracle endpoint" }));
      }
    }

    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result || {}));
  } catch (err) {
    console.error("Handler error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

const create_server = ({ oracle, app } = {}) => {
  return async (req, res) => handle_routes(req, res, oracle, app);
};

export default create_server;
