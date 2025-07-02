import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp, waitFor } from "../utils/test-utils";

describe("Geo block", () => {
  it("Show geo block popup", async () => {
    server.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        return HttpResponse.json(
          {
            code: 403,
            countryCode: "AT",
            message: "Access denied",
            regionCode: "AT-9",
            type: "GEO_LOCATION",
          },
          { status: 403 }
        );
      })
    );

    const { queryByText, unmount } = renderApp();

    await waitFor(() => expect(queryByText("Geo Block")).toBeInTheDocument());
    expect(
      queryByText("This feature is not available in Austria.")
    ).toBeInTheDocument();
    unmount();
  });
});
