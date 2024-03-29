import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);

server.events.on("response:mocked", (req) => {
  req.response.headers.set("Access-Control-Allow-Origin", "*");
  req.response.headers.set("Access-Control-Allow-Headers", "*");
});
