import { describe, expect, it } from "vitest";
import { setup } from "./setup";
import { renderApp, waitFor, within } from "../../utils/test-utils";
import { formatAddress } from "@sk-widget/utils";
import userEvent from "@testing-library/user-event";
import type { YieldDto } from "@stakekit/api-hooks";

describe("Gas warning flow", () => {
  const testFn = async ({
    yieldDto,
    withWarning,
    availableAmount,
    account,
    customConnectors,
  }: {
    availableAmount: string;
    yieldDto: YieldDto;
    withWarning: boolean;
  } & Pick<ReturnType<typeof setup>, "account" | "customConnectors">) => {
    const app = renderApp({
      wagmi: {
        __customConnectors__: customConnectors,
        forceWalletConnectOnly: false,
      },
    });

    await waitFor(() =>
      expect(app.getByText(formatAddress(account))).toBeInTheDocument()
    );

    await waitFor(() => app.getByTestId("select-opportunity").click());

    const selectContainer = await waitFor(() =>
      app.getByTestId("select-modal__container")
    );

    within(selectContainer)
      .getByTestId(`select-opportunity__item_${yieldDto.id}`, { exact: false })
      .click();

    await waitFor(() => {
      const trigger = app.getByTestId("select-opportunity");

      return expect(
        within(trigger).getByText(yieldDto.token.symbol)
      ).toBeInTheDocument();
    });

    const stakeAmount = availableAmount.toString();

    const user = userEvent.setup();

    await user.click(app.getByTestId("number-input"));
    await user.keyboard(stakeAmount);

    expect(app.getByRole("button", { name: "Stake" })).toBeInTheDocument();
    user.click(app.getByRole("button", { name: "Stake" }));

    if (withWarning) {
      await waitFor(() =>
        expect(
          app.getByText("This action is unlikely to succeed", { exact: false })
        ).toBeInTheDocument()
      );
    } else {
      await waitFor(() =>
        expect(
          app.getByText("This action is unlikely to succeed", { exact: false })
        ).not.toBeInTheDocument()
      );
    }
  };

  describe("Stake token same as gas token", () => {
    it("Txs gas > gas token amount", async () => {
      const {
        account,
        customConnectors,
        yieldWithSameGasAndStakeToken,
        setTxGas,
        setAvailableAmount,
      } = await setup();

      const totalTxGas =
        yieldWithSameGasAndStakeToken.actionDto.transactions.reduce(
          (acc, tx) => {
            setTxGas({
              yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
              txId: tx.id,
              amount: "3",
            });

            return (acc += 3);
          },
          0
        );

      const availableAmount = totalTxGas - 1;
      setAvailableAmount(availableAmount);

      testFn({
        availableAmount: availableAmount.toString(),
        withWarning: true,
        yieldDto: yieldWithSameGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });

    it("Txs gas < gas token amount", async () => {
      const {
        account,
        customConnectors,
        yieldWithSameGasAndStakeToken,
        setTxGas,
        setAvailableAmount,
      } = await setup();

      let totalTxGas = 0;
      yieldWithSameGasAndStakeToken.actionDto.transactions.forEach((tx) => {
        totalTxGas += 3;
        setTxGas({
          yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
          txId: tx.id,
          amount: "3",
        });
      });

      const availableAmount = totalTxGas + 1;
      setAvailableAmount(availableAmount);

      testFn({
        availableAmount: availableAmount.toString(),
        withWarning: false,
        yieldDto: yieldWithSameGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });
  });

  describe("Stake token different than gas token", () => {
    it("Txs gas > gas token amount", async () => {
      const {
        account,
        customConnectors,
        yieldWithDifferentGasAndStakeToken,
        setTxGas,
        setAvailableAmount,
      } = await setup();

      const totalTxGas =
        yieldWithDifferentGasAndStakeToken.actionDto.transactions.reduce(
          (acc, tx) => {
            setTxGas({
              yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
              txId: tx.id,
              amount: "3",
            });

            return (acc += 3);
          },
          0
        );

      const availableAmount = totalTxGas + 1;
      setAvailableAmount(availableAmount);

      testFn({
        availableAmount: availableAmount.toString(),
        withWarning: true,
        yieldDto: yieldWithDifferentGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });

    it("Txs gas < gas token amount", async () => {
      const {
        account,
        customConnectors,
        yieldWithDifferentGasAndStakeToken,
        setTxGas,
        setAvailableAmount,
      } = await setup();

      const totalTxGas =
        yieldWithDifferentGasAndStakeToken.actionDto.transactions.reduce(
          (acc, tx) => {
            setTxGas({
              yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
              txId: tx.id,
              amount: "3",
            });

            return (acc += 3);
          },
          0
        );

      const availableAmount = totalTxGas - 1;
      setAvailableAmount(availableAmount);

      testFn({
        availableAmount: availableAmount.toString(),
        withWarning: false,
        yieldDto: yieldWithDifferentGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });
  });
});
