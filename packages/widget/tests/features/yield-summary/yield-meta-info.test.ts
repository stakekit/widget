import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import { getConfidentialCampaignUrl } from "../../../src/domain/earn/confidential-campaign";
import type {
  EarnInvestmentSchedule,
  EarnYieldWithProvider,
} from "../../../src/domain/earn/yield-schema";
import { getYieldMetaInfo } from "../../../src/features/yield-summary/model/yield-meta-info";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");

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
const baseMechanics = yieldApiYieldDtoFixture().mechanics;

const makeYield = ({
  exit = true,
  providerName = "Aave",
  rewardSchedule = "day",
  stakeSymbol = "USDC",
  type,
}: {
  readonly exit?: boolean;
  readonly providerName?: string;
  readonly rewardSchedule?: "day" | "campaign";
  readonly stakeSymbol?: string;
  readonly type: "lending" | "vault" | "restaking";
}): EarnYieldWithProvider =>
  ({
    ...yieldApiYieldFixture({
      token: { ...usdc, symbol: stakeSymbol },
      outputToken: aUsdc,
      mechanics: { ...baseMechanics, type, rewardSchedule },
      status: { enter: true, exit },
    }),
    provider: { name: providerName },
  }) as EarnYieldWithProvider;

const metaOf = (
  yieldDto: EarnYieldWithProvider,
  now: DateTime.Utc | null = null
) =>
  getYieldMetaInfo({ now, t, token: yieldDto.token, validators: [], yieldDto });

const confidentialVault = (
  overrides?: Parameters<typeof confidentialYieldFixture>[0]
): EarnYieldWithProvider => {
  const vault = confidentialYieldFixture(overrides);
  return {
    ...vault,
    mechanics: { ...vault.mechanics, type: "vault" },
    provider: { name: "Zama" },
  } as EarnYieldWithProvider;
};

describe("getYieldMetaInfo", () => {
  describe("confidential vault", () => {
    it("describes batched settlement in the confidential context", () => {
      const yieldDto = confidentialVault();
      const meta = metaOf(yieldDto);

      expect(meta.description).toBe(
        t("details.vault.description", {
          stakeToken: yieldDto.token.symbol,
          depositToken: confidentialFixture.cShare.symbol,
          context: "confidential",
        })
      );
      expect(meta.earnPeriod).toBe(t("details.vault.earn_after_batch"));
      expect(meta.withdrawnTime).toBe(
        t("details.vault.withdrawn_time_confidential")
      );
    });

    it("names the next batch's timing once presentation time is known", () => {
      const window = {
        closesAt: "2026-10-19T15:00:00Z",
        opensAt: "2026-10-19T00:00:00Z",
      };
      const path = {
        cadence: "daily_cutoff",
        currentWindow: window,
        cutoffTime: "15:00",
        kind: "standard",
        status: "open",
      };
      const schedule = {
        redemption: { paths: [path] },
        subscription: { paths: [path] },
        timezone: "UTC",
      } as EarnInvestmentSchedule;
      const yieldDto = { ...confidentialVault(), investmentSchedule: schedule };

      const meta = metaOf(
        yieldDto,
        DateTime.makeUnsafe("2026-10-19T12:00:00Z")
      );

      expect(meta.earnPeriod).toBe(
        t("details.vault.earn_after_batch", {
          context: "timed",
          duration: "3 hours",
        })
      );
    });

    it("links its delegation campaign when it runs one", () => {
      const yieldDto = confidentialVault({
        id: "ethereum-usdc-zama-steakhouse-usdc-confidential-vault",
      });

      expect(metaOf(yieldDto).campaign).toEqual({
        i18nKey: "details.confidential_campaign",
        href: getConfidentialCampaignUrl(yieldDto),
      });
    });
  });

  describe("lending", () => {
    it("names the provider and the received token", () => {
      const meta = metaOf(makeYield({ type: "lending" }));

      expect(meta.description).toBe(
        t("details.lend.description", {
          stakeToken: "USDC",
          rewardTokens: "aUSDC",
          providerName: "Aave",
        })
      );
      expect(meta.withdrawnTime).toBe(
        t("details.lend.withdrawn_time_immediately")
      );
      expect(meta.withdrawnNotAvailable).toBeNull();
    });

    it("uses Compound's own description", () => {
      const meta = metaOf(
        makeYield({ type: "lending", providerName: "Compound v3" })
      );

      expect(meta.description).toBe(
        t("details.lend.description_compound", {
          stakeToken: "USDC",
          rewardTokens: "aUSDC",
        })
      );
    });
  });

  describe("restaking", () => {
    it("says withdrawal is unavailable while exit is closed", () => {
      const meta = metaOf(makeYield({ type: "restaking", exit: false }));

      expect(meta.withdrawnTime).toBeNull();
      expect(meta.withdrawnNotAvailable).toBe(
        t("details.restake.withdrawn_not_available", { rewardTokens: "aUSDC" })
      );
    });

    it("gives the unstake time once exit is open", () => {
      const meta = metaOf(makeYield({ type: "restaking", exit: true }));

      expect(meta.withdrawnTime).toBe(
        t("details.restake.unstake_time_immediately")
      );
      expect(meta.withdrawnNotAvailable).toBeNull();
    });
  });

  describe("campaign", () => {
    it("links the campaign of a campaign-rewarded yield", () => {
      const meta = metaOf(
        makeYield({ type: "vault", rewardSchedule: "campaign" })
      );

      expect(meta.campaign).toEqual({
        i18nKey: "details.campaign",
        href: expect.any(String),
      });
      expect(meta.positionLocked).toBeNull();
    });

    it("gives sUSD's campaign its own notes and locked-position link", () => {
      const meta = metaOf(
        makeYield({
          type: "vault",
          rewardSchedule: "campaign",
          stakeSymbol: "sUSD",
        })
      );

      expect(meta).toEqual(
        expect.objectContaining({
          campaign: {
            i18nKey: "details.campaign_susd",
            href: expect.any(String),
          },
          positionLocked: {
            i18nKey: "details.campaign_susd_position_locked",
            href: meta.campaign?.href,
          },
          description: t("details.campaign_susd_description"),
          extra: t("details.campaign_susd_extra"),
          earnRewards: null,
          withdrawnTime: null,
        })
      );
    });

    it("has no campaign for a regularly rewarded yield", () => {
      expect(metaOf(makeYield({ type: "vault" })).campaign).toBeNull();
    });
  });
});
