import * as Atom from "effect/reactivity/Atom";
import { exactDecimal } from "../../../domain/finance/exact";
import { makeConfidentialTokenBalance } from "../../yield-entry/index";
import { earnEntryAtom } from "./earn-selection/state/atoms";
import { earnPageQuoteAtom, earnPageSelectionAtom } from "./page-workflow";

const earnConfidentialTokenBalance = makeConfidentialTokenBalance(
  Atom.make((get) => {
    const quote = get(earnPageQuoteAtom);
    const tokenOption = get(earnPageSelectionAtom).token;
    return {
      owner: get(earnEntryAtom).walletScope?.address ?? null,
      publicAmount:
        tokenOption && tokenOption.amount !== null
          ? exactDecimal(tokenOption.amount)
          : null,
      token: quote.selectedToken,
      yield: quote.selectedStake,
    };
  }).pipe(Atom.withLabel("earnTokenBalanceInputAtom"))
);

export const earnTokenBalanceAtom = earnConfidentialTokenBalance.balanceAtom;
export const revealEarnTokenBalanceAtom =
  earnConfidentialTokenBalance.revealAtom;
export const revealEarnTokenBalanceStatusAtom =
  earnConfidentialTokenBalance.revealStatusAtom;
export const hideEarnTokenBalanceAtom = earnConfidentialTokenBalance.hideAtom;
