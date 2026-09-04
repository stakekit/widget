import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  type ClassicFlowSession,
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
} from "../../model/classic-transaction-flow";
import { classicTransactionFlowServiceAtom } from "./classic-flow";
import { makeClassicFlowExecutionScopeAtom } from "./classic-flow-execution";
import { makeClassicFlowReviewScopeAtom } from "./classic-flow-review";

const makeClassicFlowSessionModule = (session: ClassicFlowSession) =>
  makeScopedEffectAtom({
    acquire: (context) =>
      context
        .result(classicTransactionFlowServiceAtom)
        .pipe(Effect.flatMap((service) => service.acquireSession(session))),
    label: "classicFlowSessionScope",
    makeValue: (sessionOutcomeAtom) => {
      const getIntake = <Variant extends ClassicTransactionFlowIntake["_tag"]>(
        variant: Variant
      ): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> => {
        const intake = getClassicTransactionFlowIntakeVariant(
          session.intake,
          variant
        );
        if (!intake)
          throw new Error(`Expected Classic Flow ${variant} intake.`);
        return intake;
      };

      const facade = {
        getIntake,
        intake: session.intake,
        mount: session.mount,
      } as const;

      return {
        facade,
        ports: {
          makeExecutionScopeAtom: () =>
            makeClassicFlowExecutionScopeAtom({
              session,
              sessionOutcomeAtom,
            }),
          makeReviewScopeAtom: () =>
            makeClassicFlowReviewScopeAtom({
              session,
              sessionOutcomeAtom,
            }),
        },
      } as const;
    },
    runtime: walletRuntime,
  });

export type ClassicFlowSessionModule = Atom.Type<
  ReturnType<typeof makeClassicFlowSessionModule>
>;

export type ClassicFlowSessionFacade = ClassicFlowSessionModule["facade"];

export const makeClassicFlowReviewScope = (session: ClassicFlowSessionModule) =>
  session.ports.makeReviewScopeAtom();

export const makeClassicFlowExecutionScope = (
  session: ClassicFlowSessionModule
) => session.ports.makeExecutionScopeAtom();

type ClassicFlowReviewModule = Atom.Type<
  ReturnType<typeof makeClassicFlowReviewScope>
>;
export type ClassicFlowReviewFacade = ClassicFlowReviewModule["facade"];

type ClassicFlowExecutionModule = Atom.Type<
  ReturnType<typeof makeClassicFlowExecutionScope>
>;
export type ClassicFlowExecutionFacade = ClassicFlowExecutionModule["facade"];

export const classicFlowSessionRootAtomFamily = Atom.family(
  makeClassicFlowSessionModule
);
