import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  getConfidentialChainId,
  getConfidentialHandleContract,
  getEncryptedHandle,
  isConfidentialHandle,
  isUserRevealableBalance,
} from "../../../../domain/earn/confidential";
import { resourceInvalidationKeys } from "../../../../services/resource-invalidation";
import { ConfidentialValues } from "../../../../services/zama/confidential-values";
import { ZamaService } from "../../../../services/zama/zama-service";
import { positionDetailsWorkflowViewAtom } from "../classic-view";
import type { PositionDetailsWorkflowKey } from "../workflow";

export const revealPositionDetailsBalancesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    walletRuntime
      .fn((_input: undefined, context) =>
        Effect.gen(function* () {
          const workflow = context(positionDetailsWorkflowViewAtom(key));
          const integration = workflow.integrationData;
          const chainId = integration
            ? getConfidentialChainId(integration)
            : null;
          if (!integration || chainId === null) return;

          const handles = [...(workflow.positionBalancesByType?.values() ?? [])]
            .flat()
            .filter(isUserRevealableBalance)
            .flatMap((balance) => {
              const contract = getConfidentialHandleContract(
                integration,
                balance
              );
              const handle = getEncryptedHandle(balance);
              return handle && contract ? [{ contract, handle }] : [];
            });
          if (handles.length === 0) return;

          const zama = yield* ZamaService;
          yield* zama.revealHandles({
            chainId,
            handles,
            owner: key.scope.address,
          });
          const reactivity = yield* Reactivity.Reactivity;
          yield* reactivity.invalidate([
            ...resourceInvalidationKeys.yieldPositions(key.scope),
            ...resourceInvalidationKeys.singleYieldBalances(key.scope.address),
          ]);
        })
      )
      .pipe(Atom.withLabel("revealPositionDetailsBalancesAtom"))
);

export const hidePositionDetailsBalancesAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn(() =>
        Effect.gen(function* () {
          yield* (yield* ConfidentialValues).remove(isConfidentialHandle);
          const reactivity = yield* Reactivity.Reactivity;
          yield* reactivity.invalidate([
            ...resourceInvalidationKeys.yieldPositions(key.scope),
            ...resourceInvalidationKeys.singleYieldBalances(key.scope.address),
          ]);
        })
      )
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
