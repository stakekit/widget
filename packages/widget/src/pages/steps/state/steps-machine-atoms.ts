import { Data, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { refreshAtomResources } from "../../../atoms/api-resource";
import { config } from "../../../config";
import type {
  TokenBalanceScanCommand,
  YieldBalancesCommand,
} from "../../../domain/schema/financial-models";
import {
  TokenBalancesKey,
  tokenBalancesAtom,
} from "../../../hooks/api/token-balances-atoms";
import {
  YieldBalancesKey,
  yieldBalancesAtom,
} from "../../../hooks/api/yield-balances-atoms";
import { widgetAtomRuntime } from "../../../providers/effect-atom-runtime/widget-runtime";
import { actionHistoryTimestampAtom } from "../../../providers/stake-history";
import { WalletService } from "../../../providers/wallet/runtime/service";
import type { NormalizedWalletState } from "../../../providers/wallet/state/wallet";
import type {
  StepsMachineCommand,
  StepsMachineKey,
} from "./steps-machine-model";
import { StepsMachineService } from "./steps-machine-runtime";

export class StepsMachineAtomKey extends Data.Class<{
  readonly machineKey: StepsMachineKey;
}> {}

export const getStepsCompletionResources = (
  state: NormalizedWalletState
): ReadonlyArray<Atom.Atom<unknown>> => {
  if (state.status !== "connected") return [];

  const tokenCommand = {
    addresses: {
      address: state.address,
      ...(state.additionalAddresses
        ? { additionalAddresses: state.additionalAddresses }
        : {}),
    },
    network: state.network,
  } satisfies TokenBalanceScanCommand;
  const yieldCommand = {
    queries: [{ address: state.address, network: state.network }],
  } satisfies YieldBalancesCommand;
  const resources: Array<Atom.Atom<unknown>> = [];

  resources.push(
    tokenBalancesAtom(
      new TokenBalancesKey({
        command: tokenCommand,
        enabled: !state.isLedgerLiveAccountPlaceholder,
      })
    ),
    yieldBalancesAtom(
      new YieldBalancesKey({ command: yieldCommand, enabled: true })
    )
  );

  return resources;
};

export const getStepsMachineAtoms = Atom.family((key: StepsMachineAtomKey) => {
  const machineKey = key.machineKey;
  const machineAtom = widgetAtomRuntime
    .atom(StepsMachineService.use((steps) => steps.make(machineKey)))
    .pipe(
      Atom.setIdleTTL(config.atomResources.defaultIdleTTL),
      Atom.withLabel(`stepsMachine(${machineKey.yieldId})`)
    );
  const stateAtom = widgetAtomRuntime
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
  const eventsAtom = widgetAtomRuntime
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
  const completionAtom = widgetAtomRuntime
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
                context.set(actionHistoryTimestampAtom, Date.now());
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
  const dispatchAtom = widgetAtomRuntime.fn(
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
});
