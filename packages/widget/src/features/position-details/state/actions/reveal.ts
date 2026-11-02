import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  hideConfidentialPositions,
  revealConfidentialPositions,
} from "../../../../services/zama/confidential-positions";
import type { PositionDetailsWorkflowKey } from "../workflow";
import { positionDetailsWorkflowViewAtom } from "../workflow-view";

export const revealPositionDetailsBalancesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    walletRuntime
      .fn((_input: undefined, context) => {
        const workflow = context(positionDetailsWorkflowViewAtom(key));
        const yieldDto = workflow.integrationData;
        return revealConfidentialPositions(
          key.scope,
          yieldDto
            ? [
                {
                  balances: [
                    ...(workflow.positionBalancesByType?.values() ?? []),
                  ].flat(),
                  yieldDto,
                },
              ]
            : []
        );
      })
      .pipe(Atom.withLabel("revealPositionDetailsBalancesAtom"))
);

export const hidePositionDetailsBalancesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn(() => hideConfidentialPositions(key.scope))
      .pipe(Atom.withLabel("hidePositionDetailsBalancesAtom"))
);

export const revealPositionDetailsBalancesStatusAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const result = get(revealPositionDetailsBalancesAtom(key));
      return {
        failed: AsyncResult.isFailure(result),
        revealing: AsyncResult.isWaiting(result),
      };
    }).pipe(Atom.withLabel("revealPositionDetailsBalancesStatusAtom"))
);
