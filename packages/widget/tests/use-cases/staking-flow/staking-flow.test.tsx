import { userEvent } from "@testing-library/user-event";
import BigNumber from "bignumber.js";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { useEstimatedRewards } from "../../../src/hooks/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../src/hooks/use-reward-token-details";
import { formatAddress, formatNumber } from "../../../src/utils";
import { renderApp, renderHook, waitFor, within } from "../../utils/test-utils";
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

    const { getByTestId, getByText, getAllByText, unmount } = renderApp({
      wagmi: {
        __customConnectors__: customConnectors,
        forceWalletConnectOnly: false,
      },
    });

    await waitFor(() =>
      expect(getByText(formatAddress(account))).toBeInTheDocument()
    );

    await waitFor(() => getByTestId("select-opportunity").click());

    const selectContainer = await waitFor(() =>
      getByTestId("select-modal__container")
    );

    within(selectContainer)
      .getByTestId("select-opportunity__item_avalanche-avax-liquid-staking", {
        exact: false,
      })
      .click();

    await waitFor(() => {
      const trigger = getByTestId("select-opportunity");

      return expect(within(trigger).getByText("AVAX")).toBeInTheDocument();
    });

    const stakeAmount = "0.1";

    const user = userEvent.setup();

    await user.click(getByTestId("number-input"));
    await user.keyboard(stakeAmount);

    expect(getByTestId("number-input")).toHaveValue(stakeAmount);

    expect(getByText("Stake")).toBeInTheDocument();

    const estimatedRewards = renderHook(() =>
      useEstimatedRewards({
        selectedStake: Just(yieldOp),
        selectedValidators: new Map(),
        stakeAmount: new BigNumber(stakeAmount),
      })
    ).result.current.unsafeCoerce();

    expect(
      within(getByTestId("estimated-reward__percent")).getByText(
        estimatedRewards.percentage
      )
    ).toBeInTheDocument();

    expect(
      within(getByTestId("estimated-reward__yearly")).getByText(
        `${estimatedRewards.yearly} ${yieldOp.token.symbol}`
      )
    ).toBeInTheDocument();

    expect(
      within(getByTestId("estimated-reward__monthly")).getByText(
        `${estimatedRewards.monthly} ${yieldOp.token.symbol}`
      )
    ).toBeInTheDocument();

    const rewardTokenDetails = renderHook(() =>
      useRewardTokenDetails(Just(yieldOp))
    ).result.current.unsafeCoerce();

    expect(
      getByText(`You'll receive ${rewardTokenDetails.rewardTokens[0].symbol}`)
    ).toBeInTheDocument();

    expect(getByText("Stake")).toBeInTheDocument();

    await user.click(getByText("Stake"));

    const totalGasFee = new BigNumber(
      transactionConstruct.gasEstimate?.amount ?? 0
    );

    await waitFor(() =>
      expect(
        within(getByTestId("estimated_gas_fee")).getByText(
          `${formatNumber(totalGasFee, 10)} ${yieldOp.token.symbol}`,
          { exact: false }
        )
      ).toBeInTheDocument()
    );

    getAllByText("Liquid stake").forEach((el) =>
      expect(el).toBeInTheDocument()
    );
    getAllByText(stakeAmount).forEach((el) => expect(el).toBeInTheDocument());
    getAllByText(yieldOp.token.symbol).forEach((el) =>
      expect(el).toBeInTheDocument()
    );
    expect(getByText("& earn")).toBeInTheDocument();
    getAllByText(estimatedRewards.percentage).forEach((el) =>
      expect(el).toBeInTheDocument()
    );

    expect(getByText("Confirm")).toBeInTheDocument();

    await user.click(getByText("Confirm"));

    await waitFor(() => expect(getByText("Follow Steps")).toBeInTheDocument());

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
        getByText(`Successfully staked ${stakeAmount} ${yieldOp.token.symbol}`)
      ).toBeInTheDocument()
    );
    expect(getByText("View Stake transaction")).toBeInTheDocument();
    unmount();
  });
});
