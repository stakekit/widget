import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { exactDecimal } from "../../../domain/finance/exact";
import type { Prices } from "../../../domain/health/models";
import { tokenString } from "../../../domain/token/token";
import { PricesKey, pricesAtom } from "../../../resources/token-prices/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { config } from "../../../shared/config/widget-defaults";
import { formatUsd } from "../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../shared/lib/number-format";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  selectEarnSelectionTokenAtom,
} from "./earn-selection";
import { earnPageSearchAtom } from "./page-workflow";

export type EarnTokenSelectionItem = EarnTokenOption & {
  readonly formattedAmount: string | null;
  readonly formattedUsd: string | null;
};

const fundedAmount = (option: EarnTokenOption) => {
  if (option.amount === null) return null;
  const amount = exactDecimal(option.amount);
  return amount.isGreaterThan(0) ? amount : null;
};

const toSelectionItem = (
  option: EarnTokenOption,
  prices: Prices | null
): EarnTokenSelectionItem => {
  const amount = fundedAmount(option);
  const price = amount ? prices?.getByToken(option.token)?.price : undefined;

  return {
    ...option,
    formattedAmount: amount ? defaultFormattedNumber(amount) : null,
    formattedUsd:
      amount && price?.isGreaterThan(0) ? formatUsd(amount.times(price)) : null,
  };
};

export const earnTokenSelectionViewAtom = Atom.make((get) => {
  const options = get(earnSelectionTokenOptionsViewAtom);
  const status = get(earnSelectionStatusViewAtom);
  const search = get(earnPageSearchAtom).token;
  const funded = options.items.filter(
    (option) => fundedAmount(option) !== null
  );
  const prices = get(
    pricesAtom.foreground(
      new PricesKey({
        request:
          funded.length > 0
            ? {
                currency: config.currency,
                tokenList: funded.map((option) => option.token),
              }
            : null,
      })
    )
  ).pipe(AsyncResult.value, Option.getOrNull);
  const all = options.items.map((option) => toSelectionItem(option, prices));
  const normalizedSearch = search.toLowerCase();
  const filtered = normalizedSearch
    ? all.filter(
        (option) =>
          option.token.name.toLowerCase().includes(normalizedSearch) ||
          option.token.symbol.toLowerCase().includes(normalizedSearch)
      )
    : all;
  const loading =
    status.loading.wallet ||
    status.loading.tokens ||
    status.loading.initialSelection ||
    (options.waiting && all.length === 0);

  return {
    all,
    filtered,
    isLoading: loading,
    search,
    selected: options.selected,
  } as const;
}).pipe(Atom.withLabel("earnTokenSelectionViewAtom"));

export const setEarnTokenSearchAtom = Atom.fnSync((token: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, token });
}).pipe(Atom.withLabel("setEarnTokenSearchAtom"));

export const selectEarnTokenAtom = appRuntime
  .fn((token: EarnTokenOption, context) => {
    context.set(selectEarnSelectionTokenAtom, tokenString(token.token));
    return TrackingService.use((tracking) =>
      tracking.trackEvent("tokenSelected", { token: token.token.symbol })
    );
  })
  .pipe(Atom.withLabel("selectEarnTokenAtom"));
