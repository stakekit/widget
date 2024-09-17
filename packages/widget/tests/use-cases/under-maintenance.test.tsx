import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp, waitFor } from "../utils/test-utils";

describe("Under maintenance", () => {
  it("Show under maintenance popup", async () => {
    server.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        return HttpResponse.json(
          {
            code: 500,
          },
          { status: 500 }
        );
      }),
      http.get("*/v1/tokens", async () => {
        return HttpResponse.json(
          {
            code: 500,
          },
          { status: 500 }
        );
      })
    );

    const { unmount, getByTestId } = renderApp();

    await waitFor(() =>
      expect(getByTestId("under-maintenance")).toBeInTheDocument()
    );
    unmount();
  });
});
