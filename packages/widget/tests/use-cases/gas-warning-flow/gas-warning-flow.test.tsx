import type { YieldDto } from "@stakekit/api-hooks";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { formatAddress } from "../../../src/utils";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./setup";

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
      .getByTestId(new RegExp(`^select-opportunity__item_${yieldDto.id}`))
      .click();

    await expect
      .poll(
        () =>
          app.getByTestId("select-opportunity").getByText(yieldDto.token.symbol)
            .length
      )
      .greaterThan(0);

    const stakeAmount = availableAmount.toString();

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard(stakeAmount);

    await expect
      .element(app.getByRole("button", { name: "Stake" }))
      .toBeInTheDocument();
    await userEvent.click(app.getByRole("button", { name: "Stake" }));

    if (withWarning) {
      await expect
        .element(
          app.getByText("This action is unlikely to succeed", { exact: false })
        )
        .toBeInTheDocument();
    } else {
      await expect
        .element(
          app.getByText("This action is unlikely to succeed", { exact: false })
        )
        .not.toBeInTheDocument();
    }
    app.unmount();
  };

  describe("Stake token same as gas token", () => {
    it("Txs gas > gas token amount", async () => {
      const {
        account,
        customConnectors,
        yieldWithSameGasAndStakeToken,
        setTxGas,
        setAvalanceCTokenAmount,
      } = setup();

      const totalTxGas = 4;
      const availableAmount = totalTxGas - 1;

      setTxGas({
        yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
        amount: totalTxGas.toString(),
      });
      setAvalanceCTokenAmount(availableAmount);

      await testFn({
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
        setAvalanceCTokenAmount,
      } = setup();

      const totalTxGas = 4;
      const availableAmount = totalTxGas + 1;

      setTxGas({
        yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
        amount: totalTxGas.toString(),
      });
      setAvalanceCTokenAmount(availableAmount);

      await testFn({
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
        setUsdcTokenAmount,
      } = setup();

      const totalTxGas = 4;
      const availableAmount = totalTxGas - 1;

      setTxGas({
        yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
        amount: totalTxGas.toString(),
      });
      setUsdcTokenAmount(availableAmount);

      await testFn({
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
        setUsdcTokenAmount,
      } = setup();

      const totalTxGas = 4;
      const availableAmount = totalTxGas + 1;

      setTxGas({
        yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
        amount: totalTxGas.toString(),
      });
      setUsdcTokenAmount(availableAmount);

      await testFn({
        availableAmount: availableAmount.toString(),
        withWarning: false,
        yieldDto: yieldWithDifferentGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });
  });
});
