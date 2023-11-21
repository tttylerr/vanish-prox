import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import { createServer } from "node:http";
import { publicPath } from "ultraviolet-static";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { join } from "node:path";
import { hostname } from "node:os";
import fs from 'fs';

const cert = fs.readFileSync('ssl/certificate.crt')
const ca = fs.readFileSync('ssl/ca_bundle.crt')
const key = fs.readFileSync('ssl/private.key')

const bare = createBareServer("/bare/");
const app = express();


let options = {
  cert: cert, 
  ca: ca, 
  key: key 
};


app.use(express.static(publicPath));

app.use("/uv/", express.static(uvPath));

app.use((req, res) => {
  res.status(404);
  res.sendFile(join(publicPath, "404.html"));
});

const server = createServer(options);

server.on("request", (req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 443;

server.on("listening", async () => {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const localVersion = packageJson.version;
    const versionTxt = fs.readFileSync('./sodium-static/public/version.txt', 'utf8').trim();

    if (localVersion !== versionTxt) {
      console.log('\x1b[32m[Sodium] Update is available ' + versionTxt + '. Check the GitHub for more info.\x1b[0m');
      startServer();
    } else {
      console.log('\x1b[32m[Sodium] Your up to date!\x1b[0m');
      startServer();
    }
  } catch (error) {
    console.error('\x1b[31mError checking for updates:', error, '\x1b[0m');
    startServer();
  }
});

function startServer() { 
  const address = server.address();

  console.log("Sodium is running on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  if (address.family === "IPv4") {
    console.log(`\thttp://${address.address}:${address.port}`);
  } else {
    console.log(`\thttp://[${address.address}]:${address.port}`);
  }
}

server.listen({
  port,
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close();
  bare.close();
  process.exit(0);
}
