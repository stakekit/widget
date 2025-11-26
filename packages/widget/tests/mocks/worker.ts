import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

worker.events.on("response:mocked", (req) => {
  req.response.headers.set("Access-Control-Allow-Origin", "*");
  req.response.headers.set("Access-Control-Allow-Headers", "*");
});
