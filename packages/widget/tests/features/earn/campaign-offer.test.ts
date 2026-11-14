import { describe, expect, it } from "vitest";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import { YieldId } from "../../../src/domain/identity/identifiers";
import { tokenString } from "../../../src/domain/token/token";
import { getCampaignOffer } from "../../../src/features/earn/state/campaign-offer";
import type { EarnTokenOption } from "../../../src/features/earn/state/earn-selection/types";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../../fixtures";

const baseYield = yieldApiYieldDtoFixture();

const vault = (
  id: string,
  overrides: Partial<Parameters<typeof yieldApiYieldFixture>[0]> = {}
): EarnYieldWithProvider =>
  yieldApiYieldFixture({
    id,
    mechanics: { ...baseYield.mechanics, type: "vault" },
    ...overrides,
  });

const selected = vault("ethereum-usdc-main-vault");
const campaignYield = vault("ethereum-usdc-allez-vault");

const optionFor = (
  yieldDto: EarnYieldWithProvider,
  availableYields: ReadonlyArray<string> = [yieldDto.id]
): EarnTokenOption => ({
  token: yieldDto.token,
  availableYields: availableYields.map((id) => YieldId.make(id)),
  amount: null,
  funded: false,
  source: "default",
});

const offer = (input: Partial<Parameters<typeof getCampaignOffer>[0]> = {}) => {
  const result = getCampaignOffer({
    category: "defi",
    selectedYield: selected,
    tokenOptions: [optionFor(campaignYield)],
    yieldDto: campaignYield,
    ...input,
  });
  return result ? { offered: result.yieldDto.id, ...result.target } : null;
};

describe("getCampaignOffer", () => {
  it("offers the campaign's yield with the category and token that select it", () => {
    expect(offer()).toEqual({
      offered: campaignYield.id,
      category: "defi",
      tokenKey: tokenString(campaignYield.token),
      yieldId: campaignYield.id,
    });
  });

  it("offers nothing for a yield on another network than the selected one", () => {
    expect(
      offer({
        yieldDto: vault(campaignYield.id, {
          token: { ...baseYield.token, network: "polygon" },
        }),
      })
    ).toBeNull();
  });

  it("offers nothing the user couldn't select: a yield no token lists, closed to deposits, or the selected one", () => {
    expect(offer({ tokenOptions: [optionFor(selected)] })).toBeNull();
    expect(
      offer({
        yieldDto: vault(campaignYield.id, {
          status: { ...baseYield.status, enter: false },
        }),
      })
    ).toBeNull();
    expect(
      offer({ yieldDto: selected, tokenOptions: [optionFor(selected)] })
    ).toBeNull();
  });
});
