import { describe, expect, it } from "vitest";
import { setStorageItem } from "../../../src/services/local-storage";
import { formatAddress } from "../../../src/utils";
import { fireEvent, renderApp, waitFor } from "../../utils/test-utils";
import { setup } from "./setup";

describe("Referral flow", () => {
  it("On valid referral, shows app and url with referral code", async () => {
    const {
      validReferral,
      referralCodeRes,
      setUrl,
      customConnectors,
      account,
    } = setup();

    const { origin } = setUrl(validReferral);

    const { queryByText, queryByTestId } = renderApp({
      referralCheck: true,
      wagmi: {
        __customConnectors__: customConnectors,
        forceWalletConnectOnly: false,
      },
    });

    await waitFor(() => expect(queryByText("Positions")).toBeInTheDocument());
    await waitFor(() =>
      expect(queryByTestId("number-input")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(queryByText(formatAddress(account))).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        queryByText(`${origin}/?ref=${referralCodeRes.code}`)
      ).toBeInTheDocument()
    );
  });

  it("On app load without referral query param, gets previous from local storage", async () => {
    const {
      validReferral,
      referralCodeRes,
      setUrl,
      customConnectors,
      account,
    } = setup();

    setStorageItem("sk-widget@1//referralCode", validReferral);
    const { origin } = setUrl();

    const { queryByText, queryByTestId } = renderApp({
      referralCheck: true,
      wagmi: {
        __customConnectors__: customConnectors,
        forceWalletConnectOnly: false,
      },
    });

    await waitFor(() => expect(queryByText("Positions")).toBeInTheDocument());
    await waitFor(() =>
      expect(queryByTestId("number-input")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(queryByText(formatAddress(account))).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        queryByText(`${origin}/?ref=${referralCodeRes.code}`)
      ).toBeInTheDocument()
    );
  });

  it("On non-valid referral, shows manual referral flow", async () => {
    const { invalidReferral, validReferral, setUrl } = setup();

    setUrl();

    const { queryByText, queryAllByRole, queryByTestId, getByRole } = renderApp(
      { referralCheck: true }
    );

    await waitFor(() =>
      expect(queryByText("Referral check")).toBeInTheDocument()
    );
    expect(queryByText("Positions")).not.toBeInTheDocument();
    expect(queryByTestId("number-input")).not.toBeInTheDocument();
    expect(queryByText("Connect Wallet")).not.toBeInTheDocument();

    await waitFor(() =>
      expect(queryByText("Referral check")).toBeInTheDocument()
    );
    const inputs = await waitFor(() => queryAllByRole("textbox"));

    expect(getByRole("button")).toBeDisabled();

    Array.from({ length: 6 }).forEach((_, i) => {
      fireEvent.change(inputs[i], { target: { value: invalidReferral[i] } });
    });

    const submitButton = getByRole("button");

    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(queryByText("Missing Arguments")).toBeInTheDocument()
    );

    Array.from({ length: 6 }).forEach((_, i) => {
      fireEvent.change(inputs[i], { target: { value: validReferral[i] } });
    });

    fireEvent.click(submitButton);

    await waitFor(() => expect(queryByText("Positions")).toBeInTheDocument());
    expect(queryByText("Positions")).toBeInTheDocument();
  });
});
