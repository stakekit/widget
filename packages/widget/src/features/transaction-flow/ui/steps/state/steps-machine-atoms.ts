import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../../app/runtime";
import { WalletService } from "../../../../../services/wallet/wallet-service";
import type {
  StepsMachineCommand,
  StepsMachineKey,
} from "../../../../../services/workflow/steps-machine-model";
import { StepsMachineService } from "../../../../../services/workflow/steps-machine-service";
import { config } from "../../../../../shared/config/widget-defaults";
import { refreshAtomResources } from "../../../../../shared/effect/api-resource";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../../../portfolio";
import type { NormalizedWalletState } from "../../../../wallet";
import {
  actionHistoryTimestampAtom,
  markActionHistoryChanged,
} from "../../../state/action-history";

export const getStepsCompletionResources = (
  state: NormalizedWalletState
): ReadonlyArray<Atom.Atom<unknown>> => {
  if (state.status !== "connected") return [];

  return [tokenBalancesScanResourceAtom, yieldBalancesScanResourceAtom];
};

export const getStepsMachineAtoms = Atom.family(
  (machineKey: StepsMachineKey) => {
    const machineAtom = appRuntime
      .atom(StepsMachineService.use((steps) => steps.make(machineKey)))
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`stepsMachine(${machineKey.yieldId})`)
      );
    const stateAtom = appRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.states),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`stepsMachineState(${machineKey.yieldId})`)
      );
    const eventsAtom = appRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.events),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`stepsMachineEvents(${machineKey.yieldId})`)
      );
    const completionAtom = appRuntime
      .atom(
        (context) =>
          Effect.gen(function* () {
            const [machine, wallet] = yield* Effect.all([
              context.result(machineAtom),
              WalletService,
            ]);

            return machine.events.pipe(
              Stream.filter((event) => event._tag === "StepsCompleted"),
              Stream.tap(() =>
                Effect.sync(() => {
                  context.set(
                    actionHistoryTimestampAtom,
                    markActionHistoryChanged()
                  );
                  refreshAtomResources(
                    context,
                    getStepsCompletionResources(wallet.getState())
                  );
                })
              ),
              Stream.map(() => undefined)
            );
          }).pipe(Stream.unwrap),
        { initialValue: undefined }
      )
      .pipe(
        Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
        Atom.withLabel(`stepsMachineCompletion(${machineKey.yieldId})`)
      );
    const dispatchAtom = appRuntime.fn(
      (command: StepsMachineCommand, context) =>
        context
          .result(machineAtom)
          .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
      { concurrent: false }
    );

    return {
      completionAtom,
      dispatchAtom,
      eventsAtom,
      machineAtom,
      stateAtom,
    } as const;
  }
);
