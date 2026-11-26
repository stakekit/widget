import * as Atom from "effect/reactivity/Atom";

import { pinCampaignYields } from "../../../domain/earn/campaign";
import type { YieldCategory } from "../../../domain/earn/contract";
import {
  getExtendedYieldType,
  getYieldCategory,
  getYieldRewardTokens,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { sortYields, type YieldSort } from "../../../domain/earn/yield-sort";
import type { YieldId } from "../../../domain/identity/identifiers";
import { widgetConfigAtom } from "../../../runtime/widget-config";
import { yieldCampaignAtom } from "../../campaigns/index";
import { getSearchTerms, matchesSearchTerms } from "../model/search";
import {
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionYieldOptionsViewAtom,
  selectEarnSelectionCategoryAtom,
  selectEarnSelectionYieldAtom,
} from "./earn-selection";
import { earnPageSearchAtom } from "./page-workflow";

const groupYields = (items: ReadonlyArray<EarnYieldWithProvider>) => {
  const groups = new Map<
    ReturnType<typeof getExtendedYieldType>,
    {
      readonly itemsLength: number;
      readonly type: ReturnType<typeof getExtendedYieldType>;
    }
  >();
  for (const item of items) {
    const type = getExtendedYieldType(item);
    groups.set(type, {
      itemsLength: (groups.get(type)?.itemsLength ?? 0) + 1,
      type,
    });
  }
  return [...groups.values()];
};

/**
 * The yield list's order. Unlike the search, it holds as the sheet closes, so
 * the list opens in the order last chosen.
 */
const earnYieldSortAtom = Atom.make<YieldSort>("recommended").pipe(
  Atom.keepAlive,
  Atom.withLabel("earnYieldSortAtom")
);

/**
 * The yield category the Dashboard's Earn tab stands for: the selected one
 * while category grouping splits Earn into a tab per category, else null.
 */
export const earnTabCategoryAtom = Atom.make((get) =>
  get(widgetConfigAtom).earnCategoryGrouping
    ? get(earnSelectionYieldOptionsViewAtom).selectedCategory
    : null
).pipe(Atom.withLabel("earnTabCategoryAtom"));

export const earnYieldSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom);
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const selected = yieldOptions.selected;
  // Earn Selection orders the options, and resolves the selection among them.
  const all = yieldOptions.items;
  const search = get(earnPageSearchAtom).stake;
  const searchTerms = getSearchTerms(search);
  const searchFiltered =
    searchTerms.length > 0
      ? all.filter((item) =>
          matchesSearchTerms(searchTerms, [
            item.token.name,
            item.token.symbol,
            item.metadata.name,
            item.provider?.name,
            ...getYieldRewardTokens(item).flatMap((rewardToken) => [
              rewardToken.name,
              rewardToken.symbol,
            ]),
          ])
        )
      : all;
  const categoryGrouping = config.earnCategoryGrouping;
  const category = yieldOptions.selectedCategory;
  const inCategory = (item: EarnYieldWithProvider) =>
    !categoryGrouping || !category || getYieldCategory(item) === category;
  // The campaign each yield shows, upcoming and paused ones included.
  const campaigns = new Map(
    all.flatMap((item) => {
      const campaign = get(yieldCampaignAtom(item.id));
      return campaign ? [[item.id, campaign] as const] : [];
    })
  );
  // A chosen sort orders every yield, campaign yields included; the
  // recommended order pins campaign yields first.
  const sort = get(earnYieldSortAtom);
  const inView = searchFiltered.filter(inCategory);
  const filtered =
    sort === "recommended"
      ? pinCampaignYields(inView, new Set(campaigns.keys()))
      : sortYields(inView, sort);
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status.loading.yields;

  return {
    all,
    campaigns,
    availableCategories: categoryGrouping
      ? [...yieldOptions.availableCategories]
      : [],
    filtered,
    groups: groupYields(filtered),
    isLoading:
      status.loading.wallet ||
      status.loading.initialSelection ||
      yieldLoading ||
      tokenOptionsLoading,
    search,
    selected,
    selectedCategory: category,
    sort,
  } as const;
}).pipe(Atom.withLabel("earnYieldSelectionViewAtom"));

export const setEarnYieldSearchAtom = Atom.fnSync((stake: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, stake });
}).pipe(Atom.withLabel("setEarnYieldSearchAtom"));

export const setEarnYieldSortAtom = Atom.fnSync((sort: YieldSort, context) =>
  context.set(earnYieldSortAtom, sort)
).pipe(Atom.withLabel("setEarnYieldSortAtom"));

export const selectEarnYieldAtom = Atom.fnSync((yieldId: YieldId, context) =>
  context.set(selectEarnSelectionYieldAtom, yieldId)
).pipe(Atom.withLabel("selectEarnYieldAtom"));

export const selectEarnCategoryAtom = Atom.fnSync(
  (category: YieldCategory, context) =>
    context.set(selectEarnSelectionCategoryAtom, category)
).pipe(Atom.withLabel("selectEarnCategoryAtom"));
