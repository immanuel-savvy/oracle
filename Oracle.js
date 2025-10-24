import Repos from "@godprotocol/repositories";
import { post_request } from "./utils/services.js";
import create_server from "./server.js";

class Oracle {
  constructor(mirror) {
    this.mirror = mirror;

    this.clients = {};
    this.clients_id = {};
    this.client_repos = {};
    this.content_locations = {};
    this.repos = {};
    this.god_repos = new Repos();

    this.servers = [];

    this.propagation_queue = Promise.resolve();
  }

  get_client = (client) => {
    let id = this.clients_id[client];
    return this.clients[id];
  };

  fetch = async (payload, server) => {
    try {
      let resp = await post_request({
        options: {
          ...server,
          path: `/oracle/${payload.method}`,
        },
        data: JSON.stringify(payload.args),
      });
      return resp || null;
    } catch (e) {
      console.warn("fetch error:", e.message || e);
      return null;
    }
  };

  propagate = async (payload, cb) => {
    if (!Array.isArray(this.servers)) return;

    for (let m = 0; m < this.servers.length; m++) {
      let server = this.servers[m];
      if (this.server_match(server, this.server)) continue;

      try {
        let res = await this.fetch(payload, server);
        cb && (await cb(res));
      } catch (e) {
        console.warn("propagation error:", e.message || e);
      }
    }
  };

  enqueue_propagation(fn) {
    // ensure fn always returns a Promise
    this.propagation_queue = this.propagation_queue.then(() =>
      Promise.resolve()
        .then(fn)
        .catch((e) => {
          console.warn("Queued propagation failed:", e.message || e);
        })
    );
    return this.propagation_queue;
  }

  sync_repos = async ({ filter, repo, repo_id }) => {
    let rep = this.repos[repo_id];
    repo = await this.god_repos.cloth_repo(repo);
    if (!repo) return;

    if (rep) rep.filter = filter;
    else this.repos[repo_id] = { filter, repo };
  };

  add_repo = async ({ filter, repo }, { client, no_propagate } = {}) => {
    repo = await this.god_repos.cloth_repo(repo);
    if (!repo) return;

    let repo_id = repo.repo_id();
    let propg = {
      method: "sync_repos",
      args: { filter, repo: await repo.objectify(), repo_id },
    };

    this.repos[repo_id] = { filter, repo };

    if (!no_propagate) {
      this.enqueue_propagation(() => this.propagate(propg));
    }

    let reps = this.client_repos[client?.client_id];
    if (!reps) {
      this.client_repos[client?.client_id] = [repo_id];
    } else if (!reps.includes(repo_id)) {
      reps.push(repo_id);
    }
  };

  authenticate = async ({ client }) => {
    let id = `${client.hostname}:${client.port}`;
    let client_id = `${Math.random().toString().slice(2)}:${Date.now()}`;

    this.clients[id] = { client, client_id, id };
    this.clients_id[client_id] = id;

    return { token: client_id };
  };

  get_content_location = async (path) => {
    let repos = this.content_locations[path];
    let addr = `.oracle/${path}`;

    if (!repos) {
      let read = await this.mirror.read_file(addr);
      if (read.ok) {
        repos = JSON.parse(read.content);
        this.content_locations[path] = repos;
      }
    }
    return repos;
  };

  write = async ({ path, content }, client) => {
    let reps = this.client_repos[client.client_id] || [];
    let repos = (await this.get_content_location(path)) || [];

    let response = await this.set_to_repos(path, content, {
      repos: Array.from(new Set([...repos, ...reps])),
    });

    let new_repos = response.filter((r) => !repos.includes(r));
    if (new_repos.length) {
      let locs = this.content_locations[path] || [];
      this.content_locations[path] = [...locs, ...new_repos];
      await this.mirror.write_file(
        `.oracle/${path}`,
        JSON.stringify(this.content_locations[path])
      );

      // queue propagation
      this.enqueue_propagation(() =>
        this.propagate({
          method: "sync_content_location",
          args: { path, repos: new_repos },
        })
      );
    }
  };

  write_bulk = async (contents, client) => {
    for (let c = 0; c < contents.length; c++) {
      let { path, content } = contents[c];
      await this.write({ path, content }, client);
    }
  };

  read = async (path) => {
    let result = await this.get_from_repos(path, {
      repos: await this.get_content_location(path),
    });
    return result;
  };

  set_to_repos = async (path, content, options = {}) => {
    let repos = [];
    for (let _id in this.repos) {
      let { filter, repo } = this.repos[_id];
      if (filter && !path.match(filter)) continue;

      try {
        await repo.write_file(path, content);
        repos.push(_id);
      } catch (e) {
        console.warn(`Failed writing to repo ${_id}:`, e.message || e);
      }
    }
    return repos;
  };

  get_from_repos = async (path, options = {}) => {
    let { repos } = options;
    for (let _id in this.repos) {
      if (repos && !repos.includes(_id)) continue;

      let { filter, repo } = this.repos[_id];
      if (filter && !path.match(filter)) continue;

      let content = await repo.read(path);
      if (content) {
        let repo_ = await repo.objectify();
        return { content, repo: repo_ };
      }
    }
    return { content: null, repo: null };
  };

  server_match = (s1, s2) => s1.hostname === s2.hostname && s1.port === s2.port;

  add_repos = async (repos) => {
    for (let r = 0; r < repos.length; r++) {
      let { filter, repo, repo_id } = repos[r];
      if (this.repos[repo_id]) continue;

      repo = await this.god_repos.cloth_repo(repo);
      if (repo) await this.add_repo({ filter, repo }, { no_propagate: true });
    }
  };

  on_sync = async ({ server }) => {
    if (!this.servers.find((s) => this.server_match(s, server))) {
      this.servers.push(server);
    }
    return [];
  };

  sync_content_location = async ({ path, repos }) => {
    let locs = this.content_locations[path] || [];
    this.content_locations[path] = Array.from(new Set([...locs, ...repos]));
  };

  mirrors_addr = `.mirrors/servers-0`;

  sync = async (server, mirror) => {
    this.server = server;
    this.mirror = await this.mirror.cloth_repo(mirror);

    let handler = create_server({ oracle: this });

    let servers = await this.mirror.read(this.mirrors_addr);
    if (servers) {
      servers = JSON.parse(servers);
    } else servers = [];

    if (!servers.find((s) => this.server_match(s, this.server))) {
      servers.push(this.server);
      await this.mirror.write(this.mirrors_addr, JSON.stringify(servers));
    }

    this.servers = servers;

    // queue propagation to all other servers
    this.enqueue_propagation(() =>
      this.propagate(
        { method: "on_sync", args: { server: this.server } },
        this.add_repos.bind(this)
      )
    );

    return handler;
  };
}

export default Oracle;
