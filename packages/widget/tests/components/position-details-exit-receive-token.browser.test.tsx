import { Schema } from "effect";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { TokenAddress } from "../../src/domain/schema/identifiers";
import type { AppToken } from "../../src/domain/schema/legacy-models";
import type { ExitReceiveToken } from "../../src/domain/types/action";
import { ExitReceiveTokenAccessory } from "../../src/features/position-details/ui/classic/components/exit-receive-token-accessory";
import { ExitReceiveTokenNote } from "../../src/features/position-details/ui/classic/components/exit-receive-token-note";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();
const usdsAddress = Schema.decodeSync(TokenAddress)(
  "0xdC035D45d973E3EC169d2276DDab16f1e407384F"
);
const usdcAddress = Schema.decodeSync(TokenAddress)(
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
);

const options: ReadonlyArray<ExitReceiveToken> = [
  { address: usdsAddress, symbol: "USDS" },
  { address: usdcAddress, symbol: "USDC" },
];

const usds: AppToken = {
  ...yieldApiYieldFixture().token,
  address: usdsAddress,
  name: "USDS",
  symbol: "USDS",
};
const usdc: AppToken = {
  ...yieldApiYieldFixture().token,
  address: usdcAddress,
  name: "USD Coin",
  symbol: "USDC",
};

const integration = yieldApiYieldFixture({
  inputTokens: [usds, usdc],
  providerId: "sky",
  token: usds,
  tokens: [usds],
  outputToken: {
    ...yieldApiYieldFixture().token,
    address: Schema.decodeSync(TokenAddress)(
      "0x3333333333333333333333333333333333333333"
    ),
    name: "Savings USDS",
    symbol: "sUSDS",
  },
});

const Harness = () => {
  const [selected, setSelected] = useState<ExitReceiveToken>(options[0]!);
  const selection = { options, selected };

  return (
    <>
      <ExitReceiveTokenAccessory
        integration={integration}
        onSelect={(address) => {
          const option = options.find(
            (candidate) => candidate.address === address
          );
          if (option) setSelected(option);
        }}
        positionToken={usds}
        selection={selection}
      />
      <ExitReceiveTokenNote positionToken={usds} selection={selection} />
    </>
  );
};

describe("Position Details Exit Receive Token selector", () => {
  it("opens a receive-token modal and updates the chip plus note", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <TestWidgetConfigProvider
          apiKey="test-key"
          baseUrl="https://api.example.com"
          variant="default"
          yieldsApiUrl="https://yield.example.com"
        >
          <Harness />
        </TestWidgetConfigProvider>
      </I18nextProvider>
    );

    await expect.element(app.getByText("USDS")).toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-details-exit-receive-token-note"))
      .not.toBeInTheDocument();

    await userEvent.click(
      app.getByTestId("position-details-exit-receive-token")
    );
    await expect
      .element(app.getByTestId("select-modal__title"))
      .toHaveTextContent("Select receive token");
    await expect.element(app.getByText("0xa0b8\u2026eb48")).toBeInTheDocument();

    await userEvent.click(app.getByText("USDC"));

    await expect
      .element(app.getByTestId("position-details-exit-receive-token"))
      .toHaveTextContent("USDC");
    await expect
      .element(app.getByText("You will receive USDC when you withdraw."))
      .toBeInTheDocument();
  });
});
