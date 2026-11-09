import { userEvent } from "vitest/browser";

import { formatAddress } from "../../../../src/shared/lib/general";
import { describe, expect, it } from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";
import { setup } from "./setup";

// The balance cases of the check itself are unit-tested with `checkGasAmount`
// in tests/domain/finance/check-gas-amount.test.ts.
describe("Gas warning flow", () => {
  it("warns on Review when the stake leaves too little of the gas token for gas", async ({
    worker,
  }) => {
    const {
      account,
      actionDto,
      customConnectors,
      setAvalanceCTokenAmount,
      setTxGas,
      yieldDto,
    } = setup(worker);

    const txGas = 2;
    const totalTxGas = txGas * actionDto.transactions.length;
    const stakeAmount = "1";
    // Enough for gas alone, but not once the staked amount is taken out.
    setAvalanceCTokenAmount(totalTxGas + 0.5);
    setTxGas(txGas.toString());

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    await expect
      .element(app.getByText(formatAddress(account)))
      .toBeInTheDocument();

    await app.getByTestId("select-token").click();
    await app
      .getByTestId("select-modal__container")
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
    await app
      .getByTestId("select-modal__container")
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
    await userEvent.click(
      app.getByRole("button", { name: "Stake", exact: true })
    );

    const estimatedGasFee = app.getByTestId("estimated_gas_fee");
    // The fees section is busy until the gas estimate settles.
    await expect
      .poll(() => estimatedGasFee.element().closest('[aria-busy="true"]'))
      .toBeNull();

    await expect
      .element(
        app.getByText("This action is unlikely to succeed", { exact: false })
      )
      .toBeInTheDocument();

    await app.unmount();
  });
});
