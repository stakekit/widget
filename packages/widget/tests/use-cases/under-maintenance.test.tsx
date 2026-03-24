import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

describe("Under maintenance", () => {
  it("Show under maintenance popup", async () => {
    worker.use(
      http.get("*/v2/health", async () => {
        return HttpResponse.json({ db: "FAIL" });
      })
    );

    const app = await renderApp();

    await expect
      .element(app.getByTestId("under-maintenance"))
      .toBeInTheDocument();

    app.unmount();
  });
});
