import { userEvent } from "vitest/browser";
import { formatAddress } from "../../../src/utils";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./setup";

describe("KYC gate flow", () => {
  it("gates entry behind the verification screen and opens the issuer iframe", async ({
    worker,
  }) => {
    const { customConnectors, account, kycUrl } = await setup(worker);

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

    await app
      .getByTestId("select-modal__container")
      .getByTestId(/^select-opportunity__item_avalanche-avax-liquid-staking/)
      .click();

    await expect
      .poll(
        () => app.getByTestId("select-opportunity").getByText("AVAX").length
      )
      .greaterThan(0);

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await expect.element(app.getByTestId("number-input")).toHaveValue("0.1");

    await expect.element(app.getByText("Stake").first()).toBeInTheDocument();
    await userEvent.click(app.getByText("Stake").last());

    // KYC required + not_started → verification screen, not /review.
    await expect
      .element(app.getByTestId("kyc-verification-screen"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Identity verification required").first())
      .toBeInTheDocument();

    // CTA opens the issuer KYC page in the iframe modal.
    await userEvent.click(app.getByText("Verify identity").last());

    const iframe = app.getByTestId("kyc-iframe-modal__iframe");
    await expect.element(iframe).toBeInTheDocument();
    await expect.element(iframe).toHaveAttribute("src", kycUrl);

    app.unmount();
  });
});
