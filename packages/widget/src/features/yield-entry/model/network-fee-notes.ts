import type { TFunction } from "i18next";

import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import type { AmountPanelNote } from "../../../ui/index";
import type { MaxGasReserveNote, NetworkFeeNote } from "./network-fee";

const feeText = (t: TFunction, locale: string, note: NetworkFeeNote) => {
  switch (note._tag) {
    case "Pending":
      return null;
    case "Unknown":
      return t("details.network_fee.estimate_unknown");
    case "Estimate":
      return t("details.network_fee.estimate", {
        fee: [
          `${formatTokenAmount(note.fee.amount, locale, "up")} ${note.fee.token.symbol}`,
          ...(note.fee.usd ? [`(${formatUsd(note.fee.usd, locale)})`] : []),
        ].join(" "),
      });
  }
};

const reserveText = (t: TFunction, locale: string, note: MaxGasReserveNote) => {
  switch (note._tag) {
    case "Pending":
      return null;
    case "Unstated":
      return t("details.network_fee.max_reserve_unstated", {
        symbol: note.token.symbol,
      });
    case "Reserve":
      return t("details.network_fee.max_reserve", {
        amount: formatTokenAmount(note.amount, locale, "up"),
        symbol: note.token.symbol,
      });
  }
};

/**
 * The notes under an amount about its network fee: the fee it is estimated
 * to cost, such as "Network fee ≈ 0.0003 ETH ($0.52)", and what Max leaves
 * aside for it. Each line holds its place while it loads (a placeholder) or
 * has nothing to state ("—"), so the layout below stays still as the amount
 * changes.
 */
export const getNetworkFeeNotes = ({
  fee,
  locale,
  maxGasReserve,
  t,
}: {
  readonly fee: NetworkFeeNote | null;
  readonly locale: string;
  readonly maxGasReserve: MaxGasReserveNote | null;
  readonly t: TFunction;
}): ReadonlyArray<AmountPanelNote> => [
  ...(fee ? [{ id: "network-fee", text: feeText(t, locale, fee) }] : []),
  ...(maxGasReserve
    ? [
        {
          id: "max-gas-reserve",
          text: reserveText(t, locale, maxGasReserve),
        },
      ]
    : []),
];
