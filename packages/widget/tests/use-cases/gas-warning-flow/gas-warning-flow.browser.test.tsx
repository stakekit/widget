import { userEvent } from "vitest/browser";
import { formatAddress } from "../../../src/shared/lib/general";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./setup";

describe("Gas warning flow", () => {
  const testFn = async ({
    yieldDto,
    withWarning,
    stakeAmount,
    account,
    customConnectors,
  }: {
    stakeAmount: string;
    yieldDto: ReturnType<
      typeof setup
    >["yieldWithSameGasAndStakeToken"]["yieldDto"];
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

    await app.getByTestId("select-token").click();

    let selectContainer = app.getByTestId("select-modal__container");

    await selectContainer
      .getByText(yieldDto.token.name, { exact: true })
      .click();

    await expect
      .element(
        app
          .getByTestId("select-token")
          .getByText(yieldDto.token.symbol, { exact: true })
      )
      .toBeInTheDocument();

    await app.getByTestId("select-opportunity").click();

    selectContainer = app.getByTestId("select-modal__container");

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

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard(stakeAmount);

    await expect
      .element(app.getByRole("button", { name: "Stake", exact: true }))
      .toBeInTheDocument();
    await userEvent.click(
      app.getByRole("button", { name: "Stake", exact: true })
    );

    const estimatedGasFee = app.getByTestId("estimated_gas_fee");
    await expect
      .poll(() =>
        estimatedGasFee.element().querySelector(".react-loading-skeleton")
      )
      .toBeNull();

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
    await app.unmount();
  };

  describe("Stake token same as gas token", () => {
    it("Txs gas > gas token amount", async ({ worker }) => {
      const {
        account,
        customConnectors,
        yieldWithSameGasAndStakeToken,
        setTxGas,
        setAvalanceCTokenAmount,
      } = setup(worker);

      const txGas = 2;
      const totalTxGas =
        txGas * yieldWithSameGasAndStakeToken.actionDto.transactions.length;
      const gasTokenAmount = totalTxGas - 1;
      const stakeAmount = "1";

      setTxGas({
        yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
        amount: txGas.toString(),
      });
      setAvalanceCTokenAmount(gasTokenAmount);

      await testFn({
        stakeAmount,
        withWarning: true,
        yieldDto: yieldWithSameGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });

    it("Txs gas < gas token amount", async ({ worker }) => {
      const {
        account,
        customConnectors,
        yieldWithSameGasAndStakeToken,
        setTxGas,
        setAvalanceCTokenAmount,
      } = setup(worker);

      const txGas = 2;
      const totalTxGas =
        txGas * yieldWithSameGasAndStakeToken.actionDto.transactions.length;
      const gasTokenAmount = totalTxGas + 1;
      const stakeAmount = "1";

      setTxGas({
        yieldId: yieldWithSameGasAndStakeToken.yieldDto.id,
        amount: txGas.toString(),
      });
      setAvalanceCTokenAmount(gasTokenAmount);

      await testFn({
        stakeAmount,
        withWarning: false,
        yieldDto: yieldWithSameGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });
  });

  describe("Stake token different than gas token", () => {
    it("Txs gas > gas token amount", async ({ worker }) => {
      const {
        account,
        customConnectors,
        yieldWithDifferentGasAndStakeToken,
        setTxGas,
        setAvalanceCTokenAmount,
        setUsdcTokenAmount,
      } = setup(worker);

      const txGas = 2;
      const totalTxGas =
        txGas *
        yieldWithDifferentGasAndStakeToken.actionDto.transactions.length;
      const gasTokenAmount = totalTxGas - 1;
      const stakeAmount = "1";

      setTxGas({
        yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
        amount: txGas.toString(),
      });
      setAvalanceCTokenAmount(gasTokenAmount);
      setUsdcTokenAmount(Number(stakeAmount));

      await testFn({
        stakeAmount,
        withWarning: true,
        yieldDto: yieldWithDifferentGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });

    it("Txs gas < gas token amount", async ({ worker }) => {
      const {
        account,
        customConnectors,
        yieldWithDifferentGasAndStakeToken,
        setTxGas,
        setAvalanceCTokenAmount,
        setUsdcTokenAmount,
      } = setup(worker);

      const txGas = 2;
      const totalTxGas =
        txGas *
        yieldWithDifferentGasAndStakeToken.actionDto.transactions.length;
      const gasTokenAmount = totalTxGas + 1;
      const stakeAmount = "1";

      setTxGas({
        yieldId: yieldWithDifferentGasAndStakeToken.yieldDto.id,
        amount: txGas.toString(),
      });
      setAvalanceCTokenAmount(gasTokenAmount);
      setUsdcTokenAmount(Number(stakeAmount));

      await testFn({
        stakeAmount,
        withWarning: false,
        yieldDto: yieldWithDifferentGasAndStakeToken.yieldDto,
        account,
        customConnectors,
      });
    });
  });
});
