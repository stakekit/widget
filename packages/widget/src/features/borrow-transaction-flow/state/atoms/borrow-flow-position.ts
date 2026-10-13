import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { isBorrowNetwork } from "../../../../domain/borrow/network";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../../resources/borrow-markets/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom,
} from "../../../../resources/borrow-positions/index";
import { settleBorrowPosition } from "../../model/borrow-completion";
import type { BorrowFlowSession } from "../../model/borrow-transaction-flow";

/**
 * The Session market's position once the Borrow API reports it after the
 * action. Cached positions may predate the action, and the workflow's
 * invalidation can land after completion renders, so reading starts its own
 * refresh and reports nothing until that fetch finishes. From then on it
 * follows the resource, so a failed fetch settles on a later refresh.
 */
export const makeBorrowFlowSettledPositionAtom = (
  session: BorrowFlowSession
) => {
  const { network } = session.walletScope;
  const positionsAtom = borrowPositionsResourceAtom.foreground(
    new BorrowPositionsKey({ scope: session.walletScope })
  );
  const marketsAtom = isBorrowNetwork(network)
    ? borrowMarketsResourceAtom.foreground(
        new BorrowMarketsKey({ network, scope: "all" })
      )
    : null;
  const { command, entry, summary } = session.intake;
  // Reads positions only once, so later results never retrigger the refresh.
  const refreshedAtom = Atom.make((get) => {
    get.refresh(positionsAtom);
    return Effect.ignore(
      get.resultOnce(positionsAtom, { suspendOnWaiting: true })
    );
  });

  return Atom.make((get) => {
    if (!marketsAtom || !AsyncResult.isSuccess(get(refreshedAtom))) {
      return null;
    }
    const positions = get(positionsAtom);
    const markets = get(marketsAtom);
    if (!AsyncResult.isSuccess(positions) || !AsyncResult.isSuccess(markets)) {
      return null;
    }

    return settleBorrowPosition({
      action: summary.action,
      marketId: command.args.marketId,
      markets: markets.value,
      positionMarketId:
        entry._tag === "MarketPosition"
          ? entry.marketId
          : command.args.marketId,
      positions: positions.value,
    });
  }).pipe(Atom.withLabel("borrowFlowSettledPosition"));
};
