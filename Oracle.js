import Repos from "@godprotocol/repositories";
import { post_request } from "./utils/services.js";
import create_server from "./server.js";
import {
  decrypt,
  hash,
  encrypt,
} from "@godprotocol/repositories/utils/cryptography.js";

class Oracle {
  constructor() {
    this.server = null;
    this.mirror = null;
    this.servers = new Array();

    this.clients = new Object();
    this.content_repos = new Array();
    this.client_repos = new Array();
  }

  get_from_repo = async (path, options = {}) => {
    let { repos, repo_options = {} } = options,
      content;

    for (let r = 0; r < repos.length; r++) {
      let { repo } = repos[r];

      if (repo_options && repo_options.decrypt) {
        if (typeof repo_options.decrypt === "boolean")
          repo_options.decrypt = this.manager_key;
      }
      content = await repo.read(path, repo_options);
      if (content) {
        return { content, repo };
      }
    }
    return {};
  };

  set_to_repos = async (path, content, options = {}) => {
    let { repos, repo_options } = options,
      passes = [];

    for (let r = 0; r < repos.length; r++) {
      let { filter, repo } = repos[r];
      if (filter && !path.match(filter)) continue;

      if (repo_options && repo_options.encrypt) {
        if (typeof repo_options.encrypt === "boolean")
          repo_options.encrypt = this.manager_key;
      }

      await repo.write(path, content, repo_options);
      passes.push(repo);
    }
    return passes;
  };

  add_repo = async (payload, client) => {
    let res = decrypt(payload.repo, this.manager_key);
    res = res && JSON.parse(res);
    let { filter, repo } = res;

    repo = await this.cloth_repo(repo);

    let repo_id = repo.repo_id();
    let reps = this.client_repos[client.id];
    if (!reps) {
      reps = [];
      this.client_repos[client.id] = reps;
    }
    if (!reps.find((r) => r.repo.repo_id() === repo_id)) {
      reps.push({ filter, repo });
    } else return;

    let list = [];
    for (let l = 0; l < reps.length; l++) {
      let { repo, filter } = reps[l];
      let repo_obj = await repo.objectify();
      list.push({ filter, repo: repo_obj });
    }

    await this.mirror.write(
      `.mirrors/clients/repos/${hash(client.id)}`,
      JSON.stringify(list),
      { encrypt: this.manager_key }
    );
  };

  get_content_repos = async (path) => {
    let repos = this.content_repos[path];

    if (repos) return repos;

    repos = await this.mirror.read(`.oracle/${path}`, {
      decrypt: this.manager_key,
    });
    if (repos) {
      repos = JSON.parse(repos);
    } else return [];

    await this.cloth_repo_list(repos);

    return (this.content_repos[path] = repos);
  };

  cloth_repo_list = async (list) => {
    for (let r = 0; r < list.length; r++) {
      let { repo, filter } = list[r];
      list[r] = { filter, repo: await this.cloth_repo(repo) };
    }
  };

  merge_repos = async (r1, r2) => {
    let lst = r1.concat(r2);
    let ids = lst.map((r) => r.repo.repo_id());

    ids = Array.from(new Set(ids));
    let repos = [];
    for (let i = 0; i < ids.length; i++) {
      let id = ids[i];
      repos.push(lst.find((r) => r.repo.repo_id() === id));
    }
    return repos;
  };

  set_content_repos = async (path, repos, new_bies) => {
    this.content_repos[path] = [...repos];
    let content_reps = [];
    for (let c = 0; c < repos.length; c++) {
      let repo = repos[c];
      content_reps[c] = {
        filter: repo.filter,
        repo: await repo.repo.objectify(),
      };
    }

    await this.mirror.write(`.oracle/${path}`, JSON.stringify(content_reps), {
      encrypt: this.manager_key,
    });
    this.propagate({
      method: "sync_content_repos",
      args: { path, repos: new_bies },
    });
  };

  fetch = async (payload, server) => {
    let response;
    try {
      response = post_request({
        options: {
          ...server,
          path: `/oracle/${payload.method}`,
        },
        data: JSON.stringify(payload.args),
      });
    } catch (e) {
      console.log(e);
    }
    return response;
  };

  propagate = async (payload) => {
    for (let s = 0; s < this.servers.length; s++) {
      let server = this.servers[s];
      if (this.server_match(server, this.server)) continue;

      this.fetch(payload, server);
    }
  };

  write = async ({ path, content, options }, client) => {
    let content_path = await this.get_content_repos(path);
    let client_repos = await this.load_client_repos(client);

    let repos = await this.merge_repos(content_path, client_repos);

    let passes = await this.set_to_repos(path, content, {
        repos,
        repo_options: options,
      }),
      store = new Array();
    for (let p = 0; p < passes.length; p++) {
      let pass = passes[p];
      if (!content_path.find((c) => c.repo.repo_id() === pass.repo_id())) {
        content_path.push({ repo: pass });
        store.push(await pass.objectify());
      }
    }

    store.length && (await this.set_content_repos(path, content_path, store));
  };

  sync_content_repos = async ({ path, repos }) => {
    let content_path = await this.get_content_repos(path, true);
    if (!content_path) return;

    for (let p = 0; p < repos.length; p++) {
      let repo = repos[p];
      if (!content_path.find((c) => c.repo.repo_id() === repo._id)) {
        content_path.push({ repo: await this.cloth_repo(repo) });
      }
    }
  };

  write_bulk = async (contents, client) => {
    for (let c = 0; c < contents.length; c++) {
      let { path, content, options } = contents[c];
      await this.write({ path, content, options }, client);
    }
  };

  read = async (path, options, client) => {
    let repos = await this.get_content_repos(path);

    let response = await this.get_from_repo(path, {
      repos,
      repo_options: options,
    });
    if (!response.content) {
      return;
    }
    response.repo = encrypt(
      JSON.stringify(await response.repo.objectify()),
      this.manager_key
    );
    return response;
  };

  load_client_repos = async ({ id }) => {
    if (this.client_repos[id]) {
      return this.client_repos[id];
    }

    let reps = await this.mirror.read(`.mirrors/clients/repos/${hash(id)}`, {
      decrypt: this.manager_key,
    });
    if (!reps) return;
    reps = JSON.parse(reps);

    await this.cloth_repo_list(reps);

    this.client_repos[id] = reps;
    return reps;
  };

  authenticate = async ({ client, key }) => {
    let token = `${Math.random().toString().slice(2)}:${Date.now()}`;

    try {
      if (this.manager_key !== decrypt(key, this.manager_key))
        throw new Error("Invalid Key");
    } catch (e) {
      return {};
    }

    let obj = {
      client,
      timestamp: Date.now(),
      token,
      id: `${client.hostname}:${client.port || ""}`,
    };
    this.clients[token] = obj;
    await this.mirror.write(
      `.mirrors/clients/${hash(token)}`,
      JSON.stringify(obj)
    );
    this.load_client_repos(obj);

    return { token };
  };

  get_client = async (token) => {
    let client = this.clients[token],
      addr = `.mirrors/clients/${hash(token)}`;
    if (!client) {
      client = await this.mirror.read(addr);
      if (client) {
        client = JSON.parse(client);
        if (client.expired) client = null;
      }
    }

    if (!client) return;
    if (Date.now() - client.timestamp > 24 * 60 * 60 * 1000) {
      client.expired = true;
      await this.mirror.write(addr, JSON.stringify(client));
      return "Client token expired. Duration lasts for 24 hours only";
    }

    return client;
  };

  cloth_repo = new Repos().cloth_repo;

  server_match = (s1, s2) => {
    return s1.hostname === s2.hostname && s1.port === s2.port;
  };

  servers_addr = `.mirrors/.servers`;

  sync_servers = async () => {
    let servers = await this.mirror.read(this.servers_addr);
    if (!servers) {
      servers = new Array();
    } else servers = JSON.parse(servers);

    if (!servers.find((s) => this.server_match(s, this.server))) {
      servers.push(this.server);
      await this.mirror.write(this.servers_addr, JSON.stringify(servers));
    }
    this.servers = servers;
  };

  sync = async (server, mirror, options = {}) => {
    let { manager_key } = options;
    this.manager_key = manager_key;
    this.server = server;
    this.mirror = await this.cloth_repo(mirror);

    await this.sync_servers();

    return create_server({ oracle: this, app: null });
  };
}

export default Oracle;
