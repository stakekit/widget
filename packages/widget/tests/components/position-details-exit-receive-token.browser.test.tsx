import { Schema } from "effect";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { TokenAddress } from "../../src/domain/schema/identifiers";
import type { ExitReceiveToken } from "../../src/domain/types/action";
import { ExitReceiveTokenSelect } from "../../src/features/position-details/ui/classic/components/exit-receive-token-select";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();
const options: ReadonlyArray<ExitReceiveToken> = [
  {
    address: Schema.decodeSync(TokenAddress)(
      "0xdC035D45d973E3EC169d2276DDab16f1e407384F"
    ),
    symbol: "USDS",
  },
  {
    address: Schema.decodeSync(TokenAddress)(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    ),
    symbol: "USDC",
  },
];

const Harness = () => {
  const [selected, setSelected] = useState<ExitReceiveToken>(options[0]!);

  return (
    <ExitReceiveTokenSelect
      onSelect={(address) => {
        const option = options.find(
          (candidate) => candidate.address === address
        );
        if (option) setSelected(option);
      }}
      selection={{ options, selected }}
    />
  );
};

describe("Position Details Exit Receive Token selector", () => {
  it("defaults to USDS and lets the user select USDC", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <Harness />
      </I18nextProvider>
    );

    await expect.element(app.getByText("Receive token")).toBeInTheDocument();
    await expect
      .element(app.getByText("USDS · 0xdC03…384F"))
      .toBeInTheDocument();

    await userEvent.click(app.getByText("USDS · 0xdC03…384F"));
    await userEvent.click(app.getByText("USDC · 0xa0b8…eb48"));

    await expect
      .element(app.getByText("USDC · 0xa0b8…eb48"))
      .toBeInTheDocument();
  });
});
