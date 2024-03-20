import { describe, expect, it } from "vitest";
import { renderApp, waitFor } from "../utils/test-utils";

describe("Renders initial page", () => {
  it("Works as expected", async () => {
    const { queryByText, queryByTestId } = renderApp();

    await waitFor(() =>
      expect(queryByTestId("number-input")).toBeInTheDocument()
    );
    expect(queryByText("Positions")).toBeInTheDocument();
    expect(queryByText("Connect Wallet")).toBeInTheDocument();
  });
});
