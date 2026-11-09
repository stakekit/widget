import type BigNumber from "bignumber.js";
import type { Presentable } from "../../../shared/effect/async-result";
import {
  formatUsd,
  unavailableFigure,
} from "../../../shared/lib/number-format";

/** Where the prices that value a fiat figure stand. */
export type PricesStatus = Presentable<unknown, unknown>["_tag"];

/**
 * An amount's fiat figure valued by prices: a placeholder while they load,
 * `—` when they failed, else the figure (or none without one).
 */
export const getPricedFiat = ({
  amountUsd,
  locale,
  status,
}: {
  readonly amountUsd: BigNumber | null;
  readonly locale: string;
  readonly status: PricesStatus;
}): { readonly fiatValue: string; readonly fiatValueLoading: boolean } => {
  switch (status) {
    case "Loading":
      return { fiatValue: "", fiatValueLoading: true };
    case "Failed":
      return { fiatValue: unavailableFigure, fiatValueLoading: false };
    case "Ready":
      return {
        fiatValue: amountUsd ? formatUsd(amountUsd, locale) : "",
        fiatValueLoading: false,
      };
  }
};
