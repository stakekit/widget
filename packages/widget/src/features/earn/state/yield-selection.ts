import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import {
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldRewardTokens,
  getYieldTypesSortRank,
} from "../../../domain/earn/yield";
import type { YieldId } from "../../../domain/identity/identifiers";
import { widgetConfigAtom } from "../../../features/widget-configuration/index";
import type { DashboardYieldCategory } from "../../../public-api/types";
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

export const earnYieldSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom);
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const selected = yieldOptions.selected;
  const availableYields = yieldOptions.items;
  const combined =
    selected && !availableYields.some((item) => item.id === selected.id)
      ? [selected, ...availableYields]
      : [...availableYields];
  const all = combined.sort(
    (left, right) =>
      right.rewardRate.total.comparedTo(left.rewardRate.total) ?? 0
  );
  const search = get(earnPageSearchAtom).stake;
  const normalizedSearch = search.toLowerCase();
  const searchFiltered = normalizedSearch
    ? all.filter(
        (item) =>
          item.token.name.toLowerCase().includes(normalizedSearch) ||
          item.token.symbol.toLowerCase().includes(normalizedSearch) ||
          item.metadata.name.toLowerCase().includes(normalizedSearch) ||
          getYieldRewardTokens(item).some(
            (rewardToken) =>
              rewardToken.name.toLowerCase().includes(normalizedSearch) ||
              rewardToken.symbol.toLowerCase().includes(normalizedSearch)
          )
      )
    : all;
  const categoryGrouping =
    config.dashboardVariant && config.yieldGrouping === "category";
  const category = yieldOptions.selectedCategory;
  const categoryFiltered =
    categoryGrouping && category
      ? searchFiltered.filter(
          (item) => getDashboardYieldCategory(item) === category
        )
      : searchFiltered;
  const filtered = [...categoryFiltered].sort(
    (left, right) => getYieldTypesSortRank(left) - getYieldTypesSortRank(right)
  );
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status.loading.yields || yieldOptions.waiting;

  return {
    all,
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
  } as const;
}).pipe(Atom.withLabel("earnYieldSelectionViewAtom"));

export const setEarnYieldSearchAtom = Atom.fnSync((stake: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, stake });
}).pipe(Atom.withLabel("setEarnYieldSearchAtom"));

export const selectEarnYieldAtom = Atom.fnSync((yieldId: YieldId, context) =>
  context.set(selectEarnSelectionYieldAtom, yieldId)
).pipe(Atom.withLabel("selectEarnYieldAtom"));

export const selectEarnCategoryAtom = Atom.fnSync(
  (category: DashboardYieldCategory, context) =>
    context.set(selectEarnSelectionCategoryAtom, category)
).pipe(Atom.withLabel("selectEarnCategoryAtom"));
