import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { createContext, useContext } from "react";
import { Navigate, Outlet } from "react-router";
import { useWalletScopeRoute } from "../../wallet/react/wallet-scope-route";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import { classicFlowSessionFacadeFamily } from "../state/classic-flow-session-facade";
import {
  type ClassicFlowSession,
  classicFlowSessionStore,
} from "../state/classic-flow-session-store";
import { ClassicFlowSessionContext } from "./classic-flow-session-context";

const makeClassicFlowRoute = <
  Variant extends ClassicTransactionFlowIntake["_tag"],
>(
  variant: Variant,
  name: string
) => {
  type Intake = Extract<
    ClassicTransactionFlowIntake,
    { readonly _tag: Variant }
  >;
  const IntakeContext = createContext<Intake | null>(null);

  const SessionLifecycle = ({
    intake,
    session,
  }: {
    readonly intake: Intake;
    readonly session: ClassicFlowSession;
  }) => {
    const facade = classicFlowSessionFacadeFamily(session);
    useAtomMount(facade.lifecycleAtom);
    useAtomMount(facade.workflow.lifecycleAtom);

    return (
      <ClassicFlowSessionContext.Provider value={facade}>
        <IntakeContext.Provider value={intake}>
          <Outlet />
        </IntakeContext.Provider>
      </ClassicFlowSessionContext.Provider>
    );
  };

  const RouteGuard = () => {
    const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
    const walletScope = useWalletScopeRoute();
    const intake = session
      ? getClassicTransactionFlowIntakeVariant(session.intake, variant)
      : null;

    if (
      !session ||
      !intake ||
      !isClassicTransactionFlowWalletScopeValid(intake, walletScope)
    ) {
      return <Navigate to="/" replace />;
    }

    return <SessionLifecycle intake={intake} session={session} />;
  };

  const useRequiredValue = (): Intake => {
    const intake = useContext(IntakeContext);
    if (!intake) throw new Error(`${name} used outside its route guard.`);
    return intake;
  };

  SessionLifecycle.displayName = `${name}Lifecycle`;
  RouteGuard.displayName = `${name}RouteGuard`;

  return { RouteGuard, useRequiredValue };
};

const enterFlowRoute = makeClassicFlowRoute(
  "Enter",
  "EnterClassicTransactionFlow"
);
const exitFlowRoute = makeClassicFlowRoute(
  "Exit",
  "ExitClassicTransactionFlow"
);
const manageFlowRoute = makeClassicFlowRoute(
  "Manage",
  "ManageClassicTransactionFlow"
);
const activityResumeFlowRoute = makeClassicFlowRoute(
  "ActivityResume",
  "ActivityResumeClassicTransactionFlow"
);

export const EnterClassicFlowRouteGuard = enterFlowRoute.RouteGuard;
export const ExitClassicFlowRouteGuard = exitFlowRoute.RouteGuard;
export const ManageClassicFlowRouteGuard = manageFlowRoute.RouteGuard;
export const ActivityResumeClassicFlowRouteGuard =
  activityResumeFlowRoute.RouteGuard;

export const useRequiredEnterClassicTransactionFlow =
  enterFlowRoute.useRequiredValue;
export const useRequiredExitClassicTransactionFlow =
  exitFlowRoute.useRequiredValue;
export const useRequiredManageClassicTransactionFlow =
  manageFlowRoute.useRequiredValue;
export const useRequiredActivityResumeClassicTransactionFlow =
  activityResumeFlowRoute.useRequiredValue;
