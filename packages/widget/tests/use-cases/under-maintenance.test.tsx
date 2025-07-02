import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp, waitFor } from "../utils/test-utils";

describe("Under maintenance", () => {
  it("Show under maintenance popup", async () => {
    server.use(
      http.get("*/v2/health", async () => {
        return HttpResponse.json({
          db: "FAIL",
        });
      })
    );

    const { unmount, getByTestId } = renderApp();

    await waitFor(() =>
      expect(getByTestId("under-maintenance")).toBeInTheDocument()
    );
    unmount();
  });
});
