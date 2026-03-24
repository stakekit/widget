import { numberToHex } from "viem";
import { describe, expect, it } from "vitest";
import { APToPercentage } from "../../../src/utils";
import { renderApp } from "../../utils/test-utils";
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

    const withAvaxLiquidStakingApp = await renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await expect
      .element(withAvaxLiquidStakingApp.getByText("Liquid Staking"))
      .toBeInTheDocument();

    await expect
      .element(withAvaxLiquidStakingApp.getByText(`You'll receive`).first())
      .toBeInTheDocument();

    await expect
      .element(
        withAvaxLiquidStakingApp
          .getByText(`${avaxLiquidStaking.metadata.rewardTokens[0].symbol}`)
          .first()
      )
      .toBeInTheDocument();

    await expect
      .element(
        withAvaxLiquidStakingApp
          .getByText(`via ${avaxLiquidStaking.metadata.provider.name}`)
          .first()
      )
      .toBeInTheDocument();

    await expect
      .element(
        withAvaxLiquidStakingApp
          .getByText(`${APToPercentage(avaxLiquidStaking.rewardRate)}%`)
          .first()
      )
      .toBeInTheDocument();

    await withAvaxLiquidStakingApp.unmount();

    setUrl({ accountId: account, yieldId: avaxNativeStaking.id });

    const withAvaxNativeStakingApp = await renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await expect
      .element(withAvaxNativeStakingApp.getByText("Stake").first())
      .toBeInTheDocument();

    await expect
      .element(
        withAvaxNativeStakingApp
          .getByText(`${APToPercentage(avaxNativeStaking.rewardRate)}%`)
          .first()
      )
      .toBeInTheDocument();

    await withAvaxNativeStakingApp.unmount();
  });

  it("Works correctly with pending action query param without validator address requirement", async () => {
    const { customConnectors, setUrl, account, avaxLiquidStaking, requestFn } =
      await setup();

    setUrl({
      accountId: account,
      yieldId: avaxLiquidStaking.id,
      pendingaction: "CLAIM_REWARDS",
    });

    const app = await renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await expect.element(app.getByText("Claim")).toBeInTheDocument();

    await expect
      .element(
        app.getByText("By clicking confirm you agree to", { exact: false })
      )
      .toBeInTheDocument();

    await expect.element(app.getByText("Confirm").last()).toBeInTheDocument();

    await app.getByText("Confirm").last().click();

    await expect.element(app.getByText("Follow Steps")).toBeInTheDocument();

    await expect
      .poll(() => requestFn, { timeout: 1000 * 5 })
      .toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: expect.anything(),
      });

    expect(requestFn).toHaveBeenCalledWith({ method: "eth_chainId" });

    await expect
      .element(app.getByText("Successfully claimed rewards", { exact: false }))
      .toBeInTheDocument();

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

    const app = await renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await expect
      .element(app.getByText(avaxLiquidStaking.metadata.name))
      .toBeInTheDocument();

    await expect
      .element(app.getByTestId(avaxLiquidStaking.validators[0].address))
      .toBeInTheDocument();

    await app.getByTestId(avaxLiquidStaking.validators[0].address).click();
    await app.getByText("Submit").click();

    await expect.element(app.getByText("Claim")).toBeInTheDocument();

    await expect
      .element(
        app.getByText("By clicking confirm you agree to", { exact: false })
      )
      .toBeInTheDocument();

    await expect
      .element(app.getByRole("button", { name: "Confirm" }))
      .toBeInTheDocument();

    await app.getByRole("button", { name: "Confirm" }).click();

    await expect.element(app.getByText("Follow Steps")).toBeInTheDocument();

    await expect
      .poll(() => requestFn, { timeout: 1000 * 5 })
      .toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: expect.anything(),
      });

    expect(requestFn).toHaveBeenCalledWith({ method: "eth_chainId" });

    await expect
      .element(app.getByText("Successfully claimed rewards", { exact: false }))
      .toBeInTheDocument();

    await expect
      .element(app.getByText("View Claim rewards transaction"))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("Handles init network correctly", async () => {
    const { setUrl, customConnectors, requestFn, getCurrentChainId } =
      await setup();

    expect(getCurrentChainId()).not.toBe(1);
    setUrl({ network: "ethereum" });

    const app = await renderApp({
      wagmi: { __customConnectors__: customConnectors },
    });

    await expect.element(app.getByText("Ethereum")).toBeInTheDocument();

    await expect
      .poll(() => requestFn, { timeout: 1000 * 5 })
      .toHaveBeenCalledWith({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(1) }],
      });

    await app.unmount();
  });
});
