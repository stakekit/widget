import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { createContext, useContext } from "react";
import { Navigate, Outlet, useParams } from "react-router";
import {
  type BorrowTransactionWorkflowKey,
  initializeTransactionWorkflow,
  type TransactionWorkflowState,
} from "../../../services/workflow/transaction-workflow-model";
import { transactionWorkflowStateAtom } from "../../transaction-flow/state/transaction-workflow-atoms";
import {
  borrowExecutionInputAtom,
  borrowTransactionWorkflowKeyAtom,
  borrowTransactionWorkflowLifecycleAtom,
} from "./execution-state";
import { getBorrowFlowRoutes } from "./flow-routes";
import type { BorrowExecutionInput } from "./review-state";

type BorrowExecutionRouteState = {
  readonly input: BorrowExecutionInput;
  readonly key: BorrowTransactionWorkflowKey;
  readonly result: AsyncResult.AsyncResult<TransactionWorkflowState, unknown>;
  readonly state: TransactionWorkflowState;
};

type BorrowCompletionRouteState = {
  readonly input: BorrowExecutionInput;
  readonly result: {
    readonly action: BorrowTransactionWorkflowKey["action"];
    readonly submissions: TransactionWorkflowState["context"]["submissions"];
  };
};

const BorrowExecutionRouteContext =
  createContext<BorrowExecutionRouteState | null>(null);
const BorrowCompletionRouteContext =
  createContext<BorrowCompletionRouteState | null>(null);

const BorrowExecutionRoute = ({
  input,
  workflowKey,
}: {
  readonly input: BorrowExecutionInput;
  readonly workflowKey: BorrowTransactionWorkflowKey;
}) => {
  const result = useAtomValue(transactionWorkflowStateAtom(workflowKey));
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeTransactionWorkflow(workflowKey)
  );

  return (
    <BorrowExecutionRouteContext.Provider
      value={{ input, key: workflowKey, result, state }}
    >
      <Outlet />
    </BorrowExecutionRouteContext.Provider>
  );
};

export const BorrowTransactionWorkflowGuard = () => {
  useAtomMount(borrowTransactionWorkflowLifecycleAtom);
  const input = useAtomValue(borrowExecutionInputAtom);
  const workflowKey = useAtomValue(borrowTransactionWorkflowKeyAtom);
  const { marketId } = useParams();
  const { basePath } = getBorrowFlowRoutes(marketId);

  if (!input || !workflowKey) {
    return <Navigate to={basePath} replace />;
  }

  return <BorrowExecutionRoute input={input} workflowKey={workflowKey} />;
};

export const useBorrowExecutionRouteState = () => {
  const value = useContext(BorrowExecutionRouteContext);

  if (value === null) {
    throw new Error("Borrow execution used outside its route guard.");
  }

  return value;
};

export const BorrowCompletionRouteGuard = () => {
  const { input, key, state } = useBorrowExecutionRouteState();
  const { marketId } = useParams();
  const { stepsPath } = getBorrowFlowRoutes(marketId);

  if (state._tag !== "Completed") {
    return <Navigate to={stepsPath} replace />;
  }

  const action =
    state.context.domain._tag === "Borrow"
      ? state.context.domain.action
      : key.action;

  return (
    <BorrowCompletionRouteContext.Provider
      value={{
        input,
        result: { action, submissions: state.context.submissions },
      }}
    >
      <Outlet />
    </BorrowCompletionRouteContext.Provider>
  );
};

export const useBorrowCompletionRouteState = () => {
  const value = useContext(BorrowCompletionRouteContext);

  if (value === null) {
    throw new Error("Borrow completion used outside its route guard.");
  }

  return value;
};
