import type * as AtomReact from "@effect/atom-react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import { useYieldMetaInfo } from "../../../src/features/yield-summary/react/use-yield-meta-info";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../../fixtures";
import { renderHook } from "../../utils/test-utils.dom";

vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof AtomReact>()),
  useAtomValue: () => null,
}));

const usdc = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  network: "ethereum",
  address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  logoURI: "https://assets.stakek.it/tokens/usdc.svg",
} as const;
const aUsdc = {
  ...usdc,
  name: "Aave USDC",
  symbol: "aUSDC",
  address: "0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c",
};

const makeYield = ({
  type,
  outputToken,
}: {
  readonly type: "lending" | "vault" | "restaking";
  readonly outputToken: typeof usdc | typeof aUsdc;
}): EarnYieldWithProvider => {
  const base = yieldApiYieldDtoFixture({ token: usdc, outputToken });
  return {
    ...yieldApiYieldFixture({
      token: usdc,
      outputToken,
      mechanics: { ...base.mechanics, type },
    }),
    provider: { name: "Aave" },
  } as EarnYieldWithProvider;
};

const renderDescription = async (
  yieldDto: EarnYieldWithProvider,
  language: "en" | "fr" = "en"
) => {
  const i18n = createWidgetI18nInstance();
  await i18n.changeLanguage(language);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  );
  const { result } = await renderHook(
    () =>
      useYieldMetaInfo({
        selectedStake: yieldDto,
        tokenDto: yieldDto.token,
        validators: [],
      }),
    { wrapper }
  );
  return result.current;
};

// An empty token interpolation leaves "receive ." or "recevrez des .".
const emptyTokenSlot = /\s[.,]|\s$|(du|des)\s*\./;

describe("Yield meta info description", () => {
  it.each(["lending", "vault", "restaking"] as const)(
    "names the received token for %s",
    async (type) => {
      const info = await renderDescription(
        makeYield({ type, outputToken: aUsdc })
      );

      expect(info.description).toContain("aUSDC");
    }
  );

  it.each([
    ["lending", "en"],
    ["vault", "en"],
    ["restaking", "en"],
    ["lending", "fr"],
    ["vault", "fr"],
    ["restaking", "fr"],
  ] as const)(
    "drops the receive clause for %s (%s) when no token is received",
    async (type, language) => {
      const info = await renderDescription(
        makeYield({ type, outputToken: usdc }),
        language
      );

      expect(info.description).toContain("USDC");
      expect(info.description).not.toMatch(/receive|recevrez/);
      expect(info.description).not.toMatch(emptyTokenSlot);
    }
  );
});
