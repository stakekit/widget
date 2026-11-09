import BigNumber from "bignumber.js";
import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import {
  getYieldContracts,
  getYieldFacts,
} from "../../../src/features/yield-presentation/model/yield-facts";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  confidentialYieldFixture,
  yieldApiProviderFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");

const minStakeMechanics = {
  ...yieldApiYieldFixture().mechanics,
  entryLimits: {
    minimum: new BigNumber("1"),
    maximum: null,
    subsequentMinimum: null,
  },
};

const makeYield = (
  overrides?: Partial<EarnYieldWithProvider>
): EarnYieldWithProvider =>
  ({
    ...yieldApiYieldFixture(),
    provider: { name: "Midas" },
    ...overrides,
  }) as EarnYieldWithProvider;

const factOf = (yieldDto: EarnYieldWithProvider, id: string) =>
  getYieldFacts({ locale: "en", t, yieldDto }).find((fact) => fact.id === id);

describe("getYieldFacts", () => {
  it("lists price per share when yield state provides it", () => {
    const yieldDto = makeYield({
      state: {
        pricePerShareState: {
          price: new BigNumber("1.06274537"),
          shareToken: yieldApiYieldFixture().token,
        },
      },
    });

    expect(factOf(yieldDto, "price-per-share")).toEqual(
      expect.objectContaining({ label: "Price per share", value: "1.06275" })
    );
    expect(factOf(makeYield(), "price-per-share")).toBeUndefined();
  });

  it("labels the minimum amount Minimum subscription for RWA yields, else Min stake", () => {
    const rwa = makeYield({
      mechanics: { ...minStakeMechanics, type: "real_world_asset" },
    });
    const vault = makeYield({
      mechanics: { ...minStakeMechanics, type: "vault" },
    });

    expect(factOf(rwa, "min-stake")?.label).toBe("Minimum subscription");
    expect(factOf(vault, "min-stake")?.label).toBe("Min stake");
  });

  it("marks only distinct output tokens with price per share as yield-bearing", () => {
    const baseYield = yieldApiYieldFixture();
    const plain = makeYield({
      outputToken: { ...baseYield.token, symbol: "stETH" },
    });
    const yieldBearing = makeYield({
      mechanics: { ...baseYield.mechanics, rewardClaiming: "manual" },
      outputToken: { ...baseYield.token, symbol: "mUSDC" },
      state: {
        pricePerShareState: {
          price: new BigNumber("1.06274537"),
          shareToken: baseYield.token,
        },
      },
      token: { ...baseYield.token, symbol: "USDC" },
    });

    expect(factOf(plain, "reward-token")?.value).toBe("stETH");
    expect(factOf(yieldBearing, "reward-token")?.value).toBe(
      "mUSDC (yield-bearing)"
    );
  });

  it("links the provider's website and states warmup and lockup", () => {
    const integrationData = makeYield({
      provider: yieldApiProviderFixture({
        name: "Aave",
        website: "https://www.aave.com",
      }),
    });
    const facts = new Map(
      getYieldFacts({
        locale: "en",
        t,
        yieldDto: {
          ...integrationData,
          mechanics: {
            ...integrationData.mechanics,
            lockupPeriod: { seconds: 7 * 24 * 60 * 60 },
            warmupPeriod: { seconds: 3 * 24 * 60 * 60 },
          },
        },
      }).map((fact) => [fact.id, fact])
    );

    expect(facts.get("website")?.value).toEqual({
      _tag: "Link",
      href: "https://www.aave.com",
      label: "aave.com",
    });
    expect(facts.has("warmup")).toBe(true);
    expect(facts.has("lockup")).toBe(true);
    expect(factOf(makeYield(), "website")).toBeUndefined();
  });

  it("states each fee the yield charges on its own basis, with the Review's explanation", () => {
    const yieldDto = makeYield();
    const facts = getYieldFacts({
      locale: "en",
      t,
      yieldDto: {
        ...yieldDto,
        mechanics: {
          ...yieldDto.mechanics,
          fee: {
            deposit: new BigNumber("0.5"),
            management: new BigNumber("2"),
            performance: new BigNumber("20"),
            withdrawal: new BigNumber("0.15"),
          },
        },
      },
    }).filter((fact) => fact.id.endsWith("-fee"));

    expect(
      facts.map(({ id, info, label, value }) => ({ id, info, label, value }))
    ).toEqual([
      {
        id: "deposit-fee",
        info: {
          label: "About Deposit fee",
          text: t("review.deposit_fee_explanation"),
        },
        label: "Deposit fee",
        value: "0.50%",
      },
      {
        id: "withdrawal-fee",
        info: {
          label: "About Withdrawal fee",
          text: t("review.withdrawal_fee_explanation"),
        },
        label: "Withdrawal fee",
        value: "0.15%",
      },
      {
        id: "management-fee",
        info: {
          label: "About Management fee",
          text: t("review.management_fee_explanation"),
        },
        label: "Management fee",
        value: "2.00% / yr",
      },
      {
        id: "performance-fee",
        info: {
          label: "About Performance fee",
          text: t("review.performance_fee_explanation"),
        },
        label: "Performance fee",
        value: "20.00% of earnings",
      },
    ]);
  });

  it("states no fee the yield leaves unset or at zero", () => {
    const yieldDto = makeYield();
    const facts = getYieldFacts({
      locale: "en",
      t,
      yieldDto: {
        ...yieldDto,
        mechanics: {
          ...yieldDto.mechanics,
          fee: {
            deposit: new BigNumber("0"),
            performance: new BigNumber("10"),
          },
        },
      },
    });

    expect(
      facts.filter((fact) => fact.id.endsWith("-fee")).map((fact) => fact.id)
    ).toEqual(["performance-fee"]);
  });

  it("describes redemption and warmup of a batched vault by its batches", () => {
    const dailyPath = (cutoffTime: string) => ({
      cadence: "daily_cutoff",
      cutoffTime,
      kind: "standard",
      status: "open",
    });
    const integrationData = makeYield();
    const yieldDto = {
      ...integrationData,
      investmentSchedule: {
        redemption: { paths: [dailyPath("11:00")] },
        subscription: { paths: [dailyPath("15:00")] },
        timezone: "UTC",
      },
      mechanics: {
        ...integrationData.mechanics,
        cooldownPeriod: { seconds: 86_400 },
        warmupPeriod: { seconds: 86_400 },
      },
    } as EarnYieldWithProvider;
    const facts = new Map(
      getYieldFacts({
        locale: "en",
        now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
        t,
        yieldDto,
      }).map((fact) => [fact.id, fact.value])
    );

    expect(facts.get("cooldown")).toBe("Next batch in 23 hours");
    expect(facts.get("warmup")).toBe("Daily batch · 15:00 UTC");
    expect([...facts.values()]).not.toContain("1 days");
    // Without presentation time it reads as the daily batch.
    expect(factOf(yieldDto, "cooldown")?.value).toBe("Daily batch · 11:00 UTC");
  });

  it("states no static cooldown or warmup for a confidential vault", () => {
    const ids = getYieldFacts({
      locale: "en",
      now: DateTime.makeUnsafe("2026-10-19T12:00:00Z"),
      t,
      yieldDto: {
        ...confidentialYieldFixture(),
        provider: yieldApiProviderFixture({ name: "Zama" }),
      } as EarnYieldWithProvider,
    }).map((fact) => fact.id);

    expect(ids).not.toContain("cooldown");
    expect(ids).not.toContain("warmup");
  });
});

describe("getYieldContracts", () => {
  it("lists the vault and the asset contracts", () => {
    const token = yieldApiYieldFixture().token;
    const contracts = getYieldContracts(
      yieldApiYieldFixture({
        token: {
          ...token,
          address: "0x0000000000000000000000000000000000000001",
          symbol: "ETH",
        },
        outputToken: {
          ...token,
          address: "0x0000000000000000000000000000000000000002",
          symbol: "rETH",
        },
      }) as EarnYieldWithProvider,
      t
    );

    expect(contracts).toEqual([
      {
        label: "Vault",
        address: "0x0000000000000000000000000000000000000002",
      },
      {
        label: "Asset (ETH)",
        address: "0x0000000000000000000000000000000000000001",
      },
    ]);
  });
});
