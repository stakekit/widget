import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import { widgetConfigAtom } from "../../../../features/widget-configuration/index";
import { borrowIntegrationsResourceAtom } from "../../../../resources/borrow-integrations/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../../resources/borrow-markets/index";
import type { BorrowEntryFlowDetails } from "../../../borrow-transaction-flow/index";

/**
 * The flow details pane's market: the live catalog entry for the captured
 * market when it is still published, else the snapshot captured at start.
 * It never follows the entry form's selection, and never falls back to
 * another market.
 */
export const borrowFlowDetailsAtom = Atom.family(
  (captured: BorrowEntryFlowDetails) =>
    Atom.make((get): BorrowEntryFlowDetails => {
      const markets = get(
        borrowMarketsResourceAtom.foreground(
          new BorrowMarketsKey({
            network: captured.market.network,
            scope: get(widgetConfigAtom).borrowMarketsScope,
          })
        )
      ).pipe(AsyncResult.value, Option.getOrNull);
      const market =
        markets?.find((candidate) => candidate.id === captured.market.id) ??
        captured.market;
      const integration =
        get(borrowIntegrationsResourceAtom.foreground)
          .pipe(AsyncResult.value, Option.getOrNull)
          ?.find((candidate) => candidate.id === market.integrationId) ??
        captured.integration;
      const capturedCollateral = captured.collateralToken;
      const collateralToken = capturedCollateral
        ? (market.collateralTokens.find(
            (candidate) =>
              decodeTokenId(candidate.token) ===
              decodeTokenId(capturedCollateral.token)
          ) ?? capturedCollateral)
        : null;

      return { collateralToken, integration, market };
    }).pipe(Atom.withLabel("borrowFlowDetailsAtom"))
);
