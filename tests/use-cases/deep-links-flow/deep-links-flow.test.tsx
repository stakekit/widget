import { describe, expect, it } from "vitest";
import { setup } from "./setup";
import { renderApp, waitFor } from "../../utils/test-utils";
import { APToPercentage } from "../../../src/utils";
import userEvent from "@testing-library/user-event";

describe("Deep links flow", () => {
  it("Loads app with correct yield opportunity", async () => {
    const {
      customConnectors,
      setUrl,
      account,
      avaxLiquidStaking,
      avaxNativeStaking,
    } = await setup();

    setUrl({ accountId: account, yieldId: avaxLiquidStaking.id });

    const withAvaxLiquidStakingApp = renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await waitFor(() =>
      expect(
        withAvaxLiquidStakingApp.getByText("Liquid stake")
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        withAvaxLiquidStakingApp.getByText(
          `You'll receive ${avaxLiquidStaking.metadata.rewardTokens![0].symbol}`
        )
      ).toBeInTheDocument()
    );
    expect(
      withAvaxLiquidStakingApp.getByText(
        `via ${avaxLiquidStaking.metadata.provider!.name}`
      )
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        withAvaxLiquidStakingApp.getByText(
          `${APToPercentage(avaxLiquidStaking.rewardRate)}%`
        )
      ).toBeInTheDocument()
    );

    withAvaxLiquidStakingApp.unmount();

    setUrl({ accountId: account, yieldId: avaxNativeStaking.id });

    const withAvaxNativeStakingApp = renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await waitFor(() =>
      expect(withAvaxNativeStakingApp.getByText("Stake")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        withAvaxNativeStakingApp.getByText(
          `${APToPercentage(avaxNativeStaking.rewardRate)}%`
        )
      ).toBeInTheDocument()
    );
  });

  it("Works correctly with pending action query param without validator address requirement", async () => {
    const { customConnectors, setUrl, account, avaxLiquidStaking, requestFn } =
      await setup();

    setUrl({
      accountId: account,
      yieldId: avaxLiquidStaking.id,
      pendingaction: "CLAIM_REWARDS",
    });

    const app = renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await waitFor(() => expect(app.getByText("Claim")).toBeInTheDocument());

    await waitFor(() =>
      expect(
        app.getByText("By clicking confirm you agree to", { exact: false })
      ).toBeInTheDocument()
    );

    expect(app.getByText("Confirm")).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(app.getByText("Confirm"));

    await waitFor(() =>
      expect(app.getByText("Follow Steps")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(requestFn).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: expect.anything(),
      })
    );
    await waitFor(() =>
      expect(requestFn).toHaveBeenCalledWith({ method: "eth_chainId" })
    );

    await waitFor(() =>
      expect(
        app.getByText("Successfully claimed rewards", { exact: false })
      ).toBeInTheDocument()
    );
    expect(app.getByText("View Claim rewards transaction")).toBeInTheDocument();
  });

  it("Works correctly with pending action query param with validator address requirement", async () => {
    const { customConnectors, setUrl, account, avaxLiquidStaking, requestFn } =
      await setup({ withValidatorAddressesRequired: true });

    setUrl({
      accountId: account,
      yieldId: avaxLiquidStaking.id,
      pendingaction: "CLAIM_REWARDS",
    });

    const app = renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await waitFor(() =>
      expect(app.getByText(avaxLiquidStaking.metadata.name)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        app.getByTestId(avaxLiquidStaking.validators[0].address)
      ).toBeInTheDocument()
    );

    const user = userEvent.setup();

    await user.click(app.getByTestId(avaxLiquidStaking.validators[0].address));
    await user.click(app.getByText("Submit"));

    await waitFor(() => expect(app.getByText("Claim")).toBeInTheDocument());

    await waitFor(() =>
      expect(
        app.getByText("By clicking confirm you agree to", { exact: false })
      ).toBeInTheDocument()
    );

    expect(app.getByText("Confirm")).toBeInTheDocument();

    await user.click(app.getByText("Confirm"));

    await waitFor(() =>
      expect(app.getByText("Follow Steps")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(requestFn).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: expect.anything(),
      })
    );
    await waitFor(() =>
      expect(requestFn).toHaveBeenCalledWith({ method: "eth_chainId" })
    );

    await waitFor(() =>
      expect(
        app.getByText("Successfully claimed rewards", { exact: false })
      ).toBeInTheDocument()
    );
    expect(app.getByText("View Claim rewards transaction")).toBeInTheDocument();
  });
});
