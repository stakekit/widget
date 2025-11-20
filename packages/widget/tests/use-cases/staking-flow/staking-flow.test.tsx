import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useRewardTokenDetails } from "../../../src/hooks/use-reward-token-details";
import { formatAddress, formatNumber } from "../../../src/utils";
import { renderApp, renderHook } from "../../utils/test-utils";
import { setup } from "./setup";

describe("Staking flow", () => {
  it("Works as expected", async () => {
    const {
      customConnectors,
      yieldOp,
      transactionConstruct,
      account,
      requestFn,
    } = await setup();

    const app = await renderApp({
      wagmi: {
        __customConnectors__: customConnectors,
        forceWalletConnectOnly: false,
      },
    });

    await expect
      .element(app.getByText(formatAddress(account)))
      .toBeInTheDocument();

    await app.getByTestId("select-opportunity").click();

    const selectContainer = app.getByTestId("select-modal__container");

    await selectContainer
      .getByTestId(/^select-opportunity__item_avalanche-avax-liquid-staking/)
      .click();

    await expect
      .poll(
        () => app.getByTestId("select-opportunity").getByText("AVAX").length
      )
      .greaterThan(0);

    const stakeAmount = "0.1";

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard(stakeAmount);

    await expect
      .element(app.getByTestId("number-input"))
      .toHaveValue(stakeAmount);

    await expect.element(app.getByText("Stake").first()).toBeInTheDocument();

    await expect
      .element(app.getByTestId("estimated-reward__percent").getByText("5.08%"))
      .toBeInTheDocument();

    await expect
      .element(
        app
          .getByTestId("estimated-reward__yearly")
          .getByText(`0.00508 ${yieldOp.token.symbol}`)
      )
      .toBeInTheDocument();

    await expect
      .element(
        app
          .getByTestId("estimated-reward__monthly")
          .getByText(`0.00042 ${yieldOp.token.symbol}`)
      )
      .toBeInTheDocument();

    const rewardTokenDetails = (
      await renderHook(() => useRewardTokenDetails(Just(yieldOp)))
    ).result.current.unsafeCoerce();

    await expect
      .element(app.getByText(`You'll receive`).first())
      .toBeInTheDocument();
    await expect
      .element(
        app.getByText(`${rewardTokenDetails.rewardTokens[0].symbol}`).first()
      )
      .toBeInTheDocument();

    await expect.element(app.getByText("Stake").first()).toBeInTheDocument();

    await userEvent.click(app.getByText("Stake").last());

    const totalGasFee = new BigNumber(
      transactionConstruct.gasEstimate?.amount ?? 0
    );

    await expect
      .element(
        app
          .getByTestId("estimated_gas_fee")
          .getByText(
            `${formatNumber(totalGasFee, 10)} ${yieldOp.token.symbol}`,
            { exact: false }
          )
      )
      .toBeInTheDocument();

    await expect
      .element(app.getByText("Liquid Staking").first())
      .toBeInTheDocument();

    await expect
      .element(app.getByText(stakeAmount).first())
      .toBeInTheDocument();

    await expect
      .element(app.getByText(yieldOp.token.symbol).first())
      .toBeInTheDocument();
    await expect.element(app.getByText("& earn").first()).toBeInTheDocument();
    await expect.element(app.getByText("5.08%").first()).toBeInTheDocument();

    await expect.element(app.getByText("Confirm").last()).toBeInTheDocument();

    await userEvent.click(app.getByText("Confirm").last());

    await expect.element(app.getByText("Follow Steps")).toBeInTheDocument();

    await expect
      .poll(() => requestFn, { timeout: 1000 * 5 })
      .toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: expect.anything(),
      });

    await expect
      .poll(() => requestFn, { timeout: 1000 * 5 })
      .toHaveBeenCalledWith({ method: "eth_chainId" });

    await expect
      .element(
        app.getByText(
          `Successfully staked ${stakeAmount} ${yieldOp.token.symbol}`
        )
      )
      .toBeInTheDocument();
    await expect
      .element(app.getByText("View Stake transaction"))
      .toBeInTheDocument();
    app.unmount();
  });
});
