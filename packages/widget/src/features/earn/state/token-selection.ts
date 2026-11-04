import type BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { isFundedBalance } from "../../../domain/finance/funded-balance";
import type { Prices } from "../../../domain/health/models";
import { tokenString } from "../../../domain/token/token";
import { PricesKey, pricesAtom } from "../../../resources/token-prices/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { config } from "../../../shared/config/widget-defaults";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  selectEarnSelectionTokenAtom,
} from "./earn-selection";
import { earnPageSearchAtom } from "./page-workflow";

export type EarnTokenSelectionItem = EarnTokenOption & {
  /** Positive balance worth showing; the UI formats it. */
  readonly fundedAmount: BigNumber | null;
  /** USD value of `fundedAmount` when priced. */
  readonly fundedUsd: BigNumber | null;
};

const positiveAmount = (option: EarnTokenOption) =>
  option.amount?.isGreaterThan(0) ? option.amount : null;

const toSelectionItem = (
  option: EarnTokenOption,
  prices: Prices | null
): EarnTokenSelectionItem => {
  const amount = positiveAmount(option);
  const price = amount
    ? (prices?.getByToken(option.token)?.price ?? null)
    : null;
  const funded =
    amount !== null && isFundedBalance({ amount, priceUsd: price });

  return {
    ...option,
    fundedAmount: funded ? amount : null,
    fundedUsd: funded && price?.isGreaterThan(0) ? amount.times(price) : null,
  };
};

export const earnTokenSelectionViewAtom = Atom.make((get) => {
  const options = get(earnSelectionTokenOptionsViewAtom);
  const status = get(earnSelectionStatusViewAtom);
  const search = get(earnPageSearchAtom).token;
  // Price every positive balance so the funded check can use its USD value.
  const positive = options.items.filter(
    (option) => positiveAmount(option) !== null
  );
  const prices = get(
    pricesAtom.foreground(
      new PricesKey({
        request:
          positive.length > 0
            ? {
                currency: config.currency,
                tokenList: positive.map((option) => option.token),
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
