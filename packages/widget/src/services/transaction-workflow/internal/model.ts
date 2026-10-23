import { Match, Predicate } from "effect";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type { YieldAction } from "../../../domain/action/models";
import type { Action as BorrowAction } from "../../../domain/borrow/execution/action";
import { TransactionWorkflowId } from "../../../domain/identity/identifiers";
import { sameWalletScopeOwner } from "../../../domain/wallet/wallet-scope";
import {
  type ClassicTransactionWorkflowInput,
  type DirectTransactionRecord,
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowAction,
  type TransactionWorkflowCommand,
  type TransactionWorkflowContext,
  type TransactionWorkflowInput,
  TransactionWorkflowInputError,
  type TransactionWorkflowState,
  type TransactionWorkflowTransactionFor,
} from "../transaction-workflow-model";

type TransactionWorkflowBatch = TransactionWorkflowContext["batches"][number];
type TransactionWorkflowTransaction =
  TransactionWorkflowBatch["transactions"][number];
type TransactionWorkflowSource = TransactionWorkflowTransaction["source"];
type TransactionWorkflowDomainContext = TransactionWorkflowContext["domain"];

export const isTransactionWorkflowDoneStatus = (status: string) =>
  status === "CONFIRMED" || status === "SKIPPED";

const isBroadcastStatus = (status: string) =>
  status === "BROADCASTED" || status === "CONFIRMED";

const toTransaction = (
  source: Exclude<TransactionWorkflowSource, { readonly _tag: "Direct" }>
): TransactionWorkflowTransaction => ({
  source,
  meta: {
    broadcasted: isBroadcastStatus(source.transaction.status) ? true : null,
    confirmationError: null,
    done: isTransactionWorkflowDoneStatus(source.transaction.status),
    signError: null,
    signedTx: null,
    submissionIndex: null,
    url:
      source._tag === "Classic"
        ? (source.transaction.explorerUrl ?? null)
        : null,
  },
});

/**
 * A Direct transaction resumes from what its Ledger recorded: a sent one is
 * confirmed by its hash, a confirmed one is done. Until a wrap was sent, an
 * approval that confirmed earlier proves nothing about the allowance now, so
 * it is checked again; once one was, the wrap spent what the approval set.
 */
const toDirectTransaction = ({
  recorded,
  transaction,
  wrapped,
}: {
  readonly recorded: DirectTransactionRecord | undefined;
  readonly transaction: DirectTransaction;
  readonly wrapped: boolean;
}): TransactionWorkflowTransaction => {
  const record =
    recorded?._tag === "Confirmed" && transaction.approval && !wrapped
      ? undefined
      : recorded;

  return {
    source: { _tag: "Direct", transaction },
    meta: {
      broadcasted: record ? true : null,
      confirmationError: null,
      done: record?._tag === "Confirmed",
      signError: null,
      signedTx: record?.hash ?? null,
      submissionIndex: null,
      url: null,
    },
  };
};

const makeClassicTransactionWorkflowBatch = (
  transactions: YieldAction["transactions"]
): TransactionWorkflowBatch => ({
  currentStep: 1,
  id: "classic",
  totalSteps: 1,
  transactions: [...transactions]
    .sort((first, second) => (first.stepIndex ?? 0) - (second.stepIndex ?? 0))
    .map((transaction) => toTransaction({ _tag: "Classic", transaction })),
});

export const makeBorrowTransactionWorkflowBatch = (
  action: BorrowAction
): TransactionWorkflowBatch => ({
  currentStep: action.currentStep,
  id: `borrow-step-${action.currentStep}`,
  totalSteps: action.totalSteps,
  transactions: action.transactions.map((transaction) =>
    toTransaction({ _tag: "Borrow", transaction })
  ),
});

/** A confidential workflow is named after its yield until its action exists. */
export const getTransactionWorkflowId = (
  domain: TransactionWorkflowDomainContext
): TransactionWorkflowId =>
  TransactionWorkflowId.make(
    Match.value(domain).pipe(
      Match.tag(
        "Classic",
        ({ actionMeta, yieldId }) =>
          actionMeta?.actionId ?? `confidential:${yieldId}`
      ),
      Match.tag("Borrow", ({ action }) => action.id),
      Match.exhaustive
    )
  );

const toTransactionWorkflowDomain = (
  input: TransactionWorkflowInput
): TransactionWorkflowDomainContext =>
  Match.value(input).pipe(
    Match.tag(
      "Classic",
      ({ actionMeta, yieldId }): TransactionWorkflowDomainContext => ({
        _tag: "Classic",
        actionMeta,
        yieldId,
      })
    ),
    Match.tag(
      "Confidential",
      ({ yieldId }): TransactionWorkflowDomainContext => ({
        _tag: "Classic",
        actionMeta: null,
        yieldId,
      })
    ),
    Match.tag(
      "Borrow",
      ({ action }): TransactionWorkflowDomainContext => ({
        _tag: "Borrow",
        action,
      })
    ),
    Match.exhaustive
  );

export const validateTransactionWorkflowInput = (
  input: TransactionWorkflowInput
): TransactionWorkflowInputError | null => {
  const workflowId = getTransactionWorkflowId(
    toTransactionWorkflowDomain(input)
  );
  const fail = (message: string) =>
    new TransactionWorkflowInputError({ message, workflowId });
  const { actionAddress, networks } = Match.value(input).pipe(
    Match.tag("Classic", ({ actionMeta, transactions }) => ({
      actionAddress: actionMeta.address,
      networks: transactions.map(({ network }) => network),
    })),
    // Its transactions are validated once it has prepared them.
    Match.tag("Confidential", ({ preparation }) => ({
      actionAddress: preparation.command.address,
      networks: [],
    })),
    Match.tag("Borrow", ({ action }) => ({
      actionAddress: action.address,
      networks: action.transactions.map(({ network }) => network),
    })),
    Match.exhaustive
  );

  if (!actionAddress) {
    return fail("The transaction workflow has no action wallet address.");
  }

  if (
    !sameWalletScopeOwner(input.walletScope, {
      address: actionAddress,
      network: input.walletScope.network,
    })
  ) {
    return fail(
      "The transaction workflow action does not belong to its captured wallet scope."
    );
  }

  if (networks.some((network) => network !== input.walletScope.network)) {
    return fail(
      "The transaction workflow contains a transaction outside its captured wallet network."
    );
  }

  if (input._tag === "Borrow") {
    const mismatchedOwner = input.action.transactions.find(
      (transaction) =>
        !sameWalletScopeOwner(input.walletScope, {
          address: transaction.address,
          network: transaction.network,
        })
    );

    if (mismatchedOwner) {
      return fail(
        "The transaction workflow contains a transaction outside its captured wallet scope."
      );
    }
  }

  return null;
};

const withCurrentTransaction = (
  context: Omit<
    TransactionWorkflowContext,
    "currentBatchIndex" | "currentTransactionIndex"
  > & { readonly batches: readonly [TransactionWorkflowBatch] }
): TransactionWorkflowContext => {
  const currentTransactionIndex = context.batches[0].transactions.findIndex(
    ({ meta }) => !meta.done
  );

  return {
    ...context,
    currentBatchIndex: currentTransactionIndex === -1 ? null : 0,
    currentTransactionIndex:
      currentTransactionIndex === -1 ? null : currentTransactionIndex,
  };
};

const initializeTransactionWorkflowContext = (
  input: TransactionWorkflowInput,
  recorded: ReadonlyMap<DirectTransaction["id"], DirectTransactionRecord>
): TransactionWorkflowContext =>
  Match.value(input).pipe(
    Match.tag("Classic", (input) =>
      withCurrentTransaction({
        batches: [makeClassicTransactionWorkflowBatch(input.transactions)],
        domain: toTransactionWorkflowDomain(input),
        finalize: null,
        preparation: null,
        submissions: [],
      })
    ),
    // Nothing is current until the action is prepared.
    Match.tag("Confidential", (input): TransactionWorkflowContext => {
      const wrapped = input.conversion.some(
        ({ id, type }) => type === "WRAP" && recorded.has(id)
      );
      return {
        batches: [
          {
            ...makeClassicTransactionWorkflowBatch([]),
            transactions: input.conversion.map((transaction) =>
              toDirectTransaction({
                recorded: recorded.get(transaction.id),
                transaction,
                wrapped,
              })
            ),
          },
        ],
        currentBatchIndex: null,
        currentTransactionIndex: null,
        domain: toTransactionWorkflowDomain(input),
        finalize: null,
        preparation: {
          done: false,
          step: input.preparation._tag === "Encrypt" ? "encrypt" : "decrypt",
        },
        submissions: [],
      };
    }),
    Match.tag("Borrow", (input) =>
      withCurrentTransaction({
        batches: [makeBorrowTransactionWorkflowBatch(input.action)],
        domain: toTransactionWorkflowDomain(input),
        finalize: null,
        preparation: null,
        submissions: [],
      })
    ),
    Match.exhaustive
  );

const shouldConfirmWithoutSigning = (
  transaction: TransactionWorkflowTransaction
) =>
  transaction.meta.broadcasted === true ||
  (transaction.source._tag === "Borrow" &&
    transaction.source.transaction.signablePayload == null);

/**
 * The state a workflow starts in. A confidential one resumes the Direct
 * transactions its Ledger `recorded`.
 */
export const initializeTransactionWorkflow = (
  input: TransactionWorkflowInput,
  recorded: ReadonlyMap<
    DirectTransaction["id"],
    DirectTransactionRecord
  > = new Map()
): TransactionWorkflowState => {
  const context = initializeTransactionWorkflowContext(input, recorded);

  if (input._tag === "Confidential") return { _tag: "Preparing", context };

  if (input._tag === "Borrow" && input.action.status === "SUCCESS") {
    return { _tag: "Completed", context };
  }

  const current = getCurrentTransactionWorkflowTransaction(context);

  if (!current) {
    if (input._tag === "Borrow" && input.action.hasNextStep) {
      return { _tag: "Advancing", context };
    }

    return { _tag: "Disabled", context };
  }

  return shouldConfirmWithoutSigning(current)
    ? { _tag: "Confirming", context }
    : { _tag: "Signing", context };
};

/**
 * A confidential workflow's context once it prepared its action: the action's
 * transactions follow the ones the workflow already holds. An instant exit's
 * finalize only extends the exit's action with its own transactions.
 */
export const attachPreparedClassicAction = ({
  context,
  prepared,
}: {
  readonly context: TransactionWorkflowContext;
  readonly prepared: ClassicTransactionWorkflowInput;
}): TransactionWorkflowContext => {
  const held = context.batches[0] ?? makeClassicTransactionWorkflowBatch([]);
  const { finalize } = context;
  const finalizing = finalize !== null && !finalize.done;

  return withCurrentTransaction({
    ...context,
    batches: [
      {
        ...held,
        transactions: [
          ...held.transactions,
          ...makeClassicTransactionWorkflowBatch(prepared.transactions)
            .transactions,
        ],
      },
    ],
    domain: finalizing
      ? context.domain
      : {
          _tag: "Classic",
          actionMeta: prepared.actionMeta,
          yieldId: prepared.yieldId,
        },
    finalize: finalizing ? { ...finalize, done: true } : finalize,
    preparation:
      finalizing || !context.preparation
        ? context.preparation
        : { ...context.preparation, done: true },
  });
};

export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: "Classic"
): TransactionWorkflowTransactionFor<"Classic"> | null;
export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: "Direct"
): TransactionWorkflowTransactionFor<"Direct"> | null;
export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: "Borrow"
): TransactionWorkflowTransactionFor<"Borrow"> | null;
export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: TransactionWorkflowSource["_tag"]
): TransactionWorkflowTransaction | null {
  const current = getCurrentTransactionWorkflowTransaction(context);

  return current?.source._tag === kind ? current : null;
}

export const updateCurrentTransactionWorkflowTransaction = ({
  context,
  update,
}: {
  readonly context: TransactionWorkflowContext;
  readonly update: (
    current: TransactionWorkflowTransaction
  ) => TransactionWorkflowTransaction;
}): TransactionWorkflowContext => {
  if (
    context.currentBatchIndex === null ||
    context.currentTransactionIndex === null
  ) {
    return context;
  }

  return {
    ...context,
    batches: context.batches.map((batch, batchIndex) =>
      batchIndex === context.currentBatchIndex
        ? {
            ...batch,
            transactions: batch.transactions.map((transaction, index) =>
              index === context.currentTransactionIndex
                ? update(transaction)
                : transaction
            ),
          }
        : batch
    ),
  };
};

/**
 * Applies a Borrow action response to every transaction of the current batch,
 * matched by transaction identity. Remote status and payload facts replace the
 * local snapshot; local submission facts (signed payload, broadcast flag,
 * submission) are kept.
 */
export const reconcileBorrowTransactionWorkflowBatch = ({
  action,
  context,
}: {
  readonly action: BorrowAction;
  readonly context: TransactionWorkflowContext;
}): TransactionWorkflowContext => {
  const remoteById = new Map(
    action.transactions.map((transaction) => [transaction.id, transaction])
  );

  return {
    ...context,
    batches: context.batches.map((batch, batchIndex) =>
      batchIndex === context.currentBatchIndex
        ? {
            ...batch,
            transactions: batch.transactions.map((transaction) => {
              const remote =
                transaction.source._tag === "Borrow"
                  ? remoteById.get(transaction.source.transaction.id)
                  : undefined;

              return remote
                ? {
                    meta: {
                      ...transaction.meta,
                      done:
                        transaction.meta.done ||
                        isTransactionWorkflowDoneStatus(remote.status),
                    },
                    source: { _tag: "Borrow", transaction: remote },
                  }
                : transaction;
            }),
          }
        : batch
    ),
    domain: { _tag: "Borrow", action },
  };
};

export const selectNextTransactionWorkflowTransaction = (
  context: TransactionWorkflowContext
): TransactionWorkflowContext => {
  const batch = getCurrentTransactionWorkflowBatch(context);

  if (!batch) return context;

  const currentIndex = context.currentTransactionIndex ?? -1;
  const nextIndex = batch.transactions.findIndex(
    ({ meta }, index) => index > currentIndex && !meta.done
  );

  return {
    ...context,
    currentTransactionIndex: nextIndex === -1 ? null : nextIndex,
  };
};

/** Moves past the current transaction without signing it: nothing needs it. */
export const skipCurrentTransactionWorkflowTransaction = (
  context: TransactionWorkflowContext
): TransactionWorkflowContext =>
  selectNextTransactionWorkflowTransaction(
    updateCurrentTransactionWorkflowTransaction({
      context,
      update: (current) => ({
        ...current,
        meta: { ...current.meta, done: true },
      }),
    })
  );

/** Runs `transaction` before the current one; it becomes current. */
export const insertBeforeCurrentTransactionWorkflowTransaction = (
  context: TransactionWorkflowContext,
  transaction: DirectTransaction
): TransactionWorkflowContext => {
  const { currentBatchIndex, currentTransactionIndex } = context;
  if (currentBatchIndex === null || currentTransactionIndex === null) {
    return context;
  }

  return {
    ...context,
    batches: context.batches.map((batch, batchIndex) =>
      batchIndex === currentBatchIndex
        ? {
            ...batch,
            transactions: batch.transactions.toSpliced(
              currentTransactionIndex,
              0,
              toDirectTransaction({
                recorded: undefined,
                transaction,
                wrapped: false,
              })
            ),
          }
        : batch
    ),
  };
};

export const appendTransactionWorkflowBatch = ({
  batch,
  context,
  domain,
}: {
  readonly batch: TransactionWorkflowBatch;
  readonly context: TransactionWorkflowContext;
  readonly domain: TransactionWorkflowDomainContext;
}): TransactionWorkflowContext => {
  const existingIndex = context.batches.findIndex(
    (candidate) => candidate.id === batch.id
  );
  const batches =
    existingIndex === -1 ? [...context.batches, batch] : context.batches;
  const batchIndex = existingIndex === -1 ? batches.length - 1 : existingIndex;
  const currentTransactionIndex = batches[batchIndex]?.transactions.findIndex(
    ({ meta }) => !meta.done
  );

  return {
    ...context,
    batches,
    currentBatchIndex: batchIndex,
    currentTransactionIndex:
      currentTransactionIndex == null || currentTransactionIndex === -1
        ? null
        : currentTransactionIndex,
    domain,
  };
};

export const getTransactionWorkflowAction = ({
  command,
  state,
}: {
  readonly command: TransactionWorkflowCommand;
  readonly state: TransactionWorkflowState;
}): TransactionWorkflowAction | null => {
  if (command._tag !== "Retry") return null;

  switch (state._tag) {
    case "PrepareFailed":
      return state.error.retryable ? "prepare" : null;
    case "SignFailed":
      return "sign";
    case "SubmissionFailed":
      // A Direct broadcast the node refused cannot be sent again as signed.
      return Predicate.isTagged(state.error.cause, "EvmBroadcastRejectedError")
        ? "sign"
        : "submit";
    case "ConfirmationFailed": {
      // A reverted or dropped Direct transaction left no hash to wait on.
      const current = getCurrentTransactionWorkflowTransaction(state.context);
      return current?.source._tag === "Direct" && current.meta.signedTx === null
        ? "sign"
        : "confirm";
    }
    case "AdvanceFailed":
      return "advance";
    case "Disabled":
    case "Preparing":
    case "Signing":
    case "Submitting":
    case "Confirming":
    case "Advancing":
    case "Completed":
      return null;
  }
};
