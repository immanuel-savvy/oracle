import http from "http";
import https from "https";

const post_request = (payload, cb) => {
  // let options = {
  //   hostname: 'example.com',
  //   port: 80,
  //   path: '/api/users',
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Content-Length': Buffer.byteLength(postData),
  //   },
  // };

  // console.log(payload)
  return new Promise((resolve, reject) => {
    let data = payload.data;

    let header = {
      ...payload.options,
      method: payload.options.method || "POST",
      headers: {
        ...payload.options.headers,
        "Content-Type": "application/json",
      },
      rejectUnauthorized: false,
      // minVersion: "TLSv1.2",
    };
    if (payload.data) {
      header["Content-Length"] = Buffer.byteLength(data);
    }

    let mod = process.env.VERCEL ? https : http;
    let req = mod.request(header, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        // console.log('hey')
        resolve(data && JSON.parse(data));
        // console.log("Response:", data);
      });
    });

    req.on("error", (e) => {
      reject(e);
      console.error(`Problem with request: ${e.message}`);
    });

    data && req.write(data);

    req.end();
  });
};

export { post_request };
