const http = require("http");
const env = require("./config/env");
const app = require("./app");
const { initSocket } = require("./socket");

const server = http.createServer(app);
initSocket(server);

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
