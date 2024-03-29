import { expect } from "vitest";
import { renderApp, waitFor } from "../utils/test-utils";

export const rendersInitialPage = async () => {
  const { queryByText, unmount, queryByTestId } = renderApp();

  expect(queryByText("Positions")).toBeInTheDocument();
  await waitFor(() =>
    expect(queryByTestId("number-input")).toBeInTheDocument()
  );
  expect(queryByText("Connect Wallet")).toBeInTheDocument();

  unmount();
};
