import userEvent from "@testing-library/user-event";
import { numberToHex } from "viem";
import { describe, expect, it } from "vitest";
import { APToPercentage } from "../../../src/utils";
import { renderApp, waitFor } from "../../utils/test-utils";
import { setup } from "./setup";

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
        withAvaxLiquidStakingApp.getByText("Liquid Staking")
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        withAvaxLiquidStakingApp.getByText(`You'll receive`)
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        withAvaxLiquidStakingApp.getByText(
          `${avaxLiquidStaking.metadata.rewardTokens[0].symbol}`
        )
      ).toBeInTheDocument()
    );
    expect(
      withAvaxLiquidStakingApp.getByText(
        `via ${avaxLiquidStaking.metadata.provider.name}`
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
      expect(
        withAvaxNativeStakingApp.getAllByText("Stake")
      ).length.greaterThanOrEqual(1)
    );

    await waitFor(() =>
      expect(
        withAvaxNativeStakingApp.getByText(
          `${APToPercentage(avaxNativeStaking.rewardRate)}%`
        )
      ).toBeInTheDocument()
    );

    withAvaxNativeStakingApp.unmount();
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

    await waitFor(() => expect(app.getByText("Confirm")).toBeInTheDocument());

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

    app.unmount();
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

    app.unmount();
  });

  it("Handles init network correctly", async () => {
    const { setUrl, customConnectors, requestFn, getCurrentChainId } =
      await setup();

    expect(getCurrentChainId()).not.toBe(1);
    setUrl({ network: "ethereum" });

    const app = renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await waitFor(() => expect(app.getByText("Ethereum")).toBeInTheDocument());

    expect(requestFn).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: numberToHex(1) }],
    });

    app.unmount();
  });
});
