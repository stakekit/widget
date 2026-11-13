import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { YieldCategory } from "../../../domain/earn/contract";
import { getYieldCategory } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { tokenString } from "../../../domain/token/token";
import { EarnTokenCatalogKey } from "../../../resources/earn-token-catalog/earn-token-catalog";
import { earningCampaignsAtom } from "../../../resources/project-campaigns/project-campaigns";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/yield-opportunity";
import { widgetConfigAtom } from "../../../runtime/widget-config";
import { earnSelectionYieldOptionsViewAtom } from "./earn-selection";
import { earnTokenCatalogAtom } from "./earn-selection/catalog/catalog";
import { earnEntryAtom } from "./earn-selection/state/atoms";
import type {
  CatalogYieldTarget,
  EarnTokenOption,
} from "./earn-selection/types";

/** A yield with an earning campaign, and the selection that switches to it. */
export type CampaignOffer = {
  readonly yieldDto: EarnYieldWithProvider;
  readonly target: CatalogYieldTarget;
};

/**
 * The offer of `yieldDto`'s campaign beside the selected yield: null unless
 * the user could select it here, on the selected yield's network, through a
 * token of `tokenOptions` (its category's), and it takes deposits.
 */
export const getCampaignOffer = ({
  category,
  selectedYield,
  tokenOptions,
  yieldDto,
}: {
  readonly category: YieldCategory | null;
  readonly selectedYield: EarnYieldWithProvider;
  readonly tokenOptions: ReadonlyArray<EarnTokenOption>;
  readonly yieldDto: EarnYieldWithProvider;
}): CampaignOffer | null => {
  if (
    yieldDto.id === selectedYield.id ||
    !yieldDto.status.enter ||
    yieldDto.token.network !== selectedYield.token.network
  ) {
    return null;
  }
  const listing = tokenOptions.filter((option) =>
    option.availableYields.includes(yieldDto.id)
  );
  // The yield's own token first, as a deep link to it would land.
  const option =
    listing.find(
      (candidate) =>
        tokenString(candidate.token) === tokenString(yieldDto.token)
    ) ?? listing[0];
  return option
    ? {
        yieldDto,
        target: {
          category,
          tokenKey: tokenString(option.token),
          yieldId: yieldDto.id,
        },
      }
    : null;
};

/**
 * The first campaign, in the order the API lists them, that earns on another
 * yield the user could switch to, while the selected yield has no earning
 * campaign. Waits on a campaign's yield or tokens still loading, so the first
 * one wins; skips one that failed to load.
 */
export const earnCampaignOfferAtom = Atom.make((get): CampaignOffer | null => {
  const selectedYield = get(earnSelectionYieldOptionsViewAtom).selected;
  const earning = get(earningCampaignsAtom);
  if (!selectedYield || earning.has(selectedYield.id)) return null;

  const categoryGrouping = get(widgetConfigAtom).earnCategoryGrouping;
  const network = get(earnEntryAtom).walletScope?.network ?? null;
  // Every candidate's yield loads at once, not one after another.
  const candidates = [...earning.keys()].map((yieldId) =>
    get(enrichedYieldOpportunityResourceAtom.local(yieldId))
  );

  for (const yieldResult of candidates) {
    if (AsyncResult.isInitial(yieldResult)) return null;
    if (!AsyncResult.isSuccess(yieldResult)) continue;

    const yieldDto = yieldResult.value;
    const category = categoryGrouping ? getYieldCategory(yieldDto) : null;
    if (categoryGrouping && !category) continue;

    // The catalog Earn lists the category's tokens from, already loaded for
    // its categories.
    const tokens = get(
      earnTokenCatalogAtom(new EarnTokenCatalogKey({ category, network }))
    );
    if (AsyncResult.isInitial(tokens)) return null;
    if (!AsyncResult.isSuccess(tokens)) continue;

    const offer = getCampaignOffer({
      category,
      selectedYield,
      tokenOptions: tokens.value,
      yieldDto,
    });
    if (offer) return offer;
  }
  return null;
}).pipe(Atom.withLabel("earnCampaignOfferAtom"));
