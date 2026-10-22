import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  type DirectTransaction,
  makeErc20Approval,
} from "../../../src/domain/action/direct-transaction";
import {
  TransactionWorkflowId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { getClassicTransactionStepsView } from "../../../src/features/classic-transaction-flow/model/classic-transaction-workflow";
import {
  attachPreparedClassicAction,
  initializeTransactionWorkflow,
} from "../../../src/services/transaction-workflow/internal/model";
import {
  ConfidentialTransactionWorkflowInput,
  makeClassicTransactionWorkflowInput,
  makeDirectTransactionLedger,
  TransactionConfirmationError,
  TransactionPrepareError,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
} from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("zama-vault");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const approval = {
  amount: 5n,
  chainId: 11155111,
  network: "ethereum",
  owner: address as `0x${string}`,
  spender: "0x00000000000000000000000000000000000000c0",
  token: "0x00000000000000000000000000000000000000a0",
} as const;
const reset = makeErc20Approval({
  ...approval,
  id: "conversion-approval",
  type: "RESET_APPROVAL",
});
const approve = makeErc20Approval({
  ...approval,
  id: "conversion-approval",
  type: "APPROVAL",
});
const wrap: DirectTransaction = {
  approval: null,
  chainId: 11155111,
  data: "0x00",
  id: "conversion-wrap",
  network: "ethereum",
  to: approval.spender,
  type: "WRAP",
};

const makeInput = (conversion: ReadonlyArray<DirectTransaction>) =>
  new ConfidentialTransactionWorkflowInput({
    conversion,
    inputToken: undefined,
    ledger: makeDirectTransactionLedger(),
    preparation: {
      _tag: "Encrypt",
      amount: 5n,
      assetAddress: null,
      balance: null,
      command: { address, yieldId },
      conversion: null,
      instant: false,
      intent: "enter",
      requiresPermitSigner: true,
      yieldDto: {} as never,
    },
    providersDetails: [],
    walletScope,
    yieldId,
  });

const view = (state: TransactionWorkflowState) =>
  getClassicTransactionStepsView(state, {
    preparedTransactionType: "DEPOSIT",
    yieldId,
  });

const rows = (state: TransactionWorkflowState) => {
  const { numbered, retryable, txStates } = view(state);
  return {
    numbered,
    retryable,
    rows: txStates.map(({ done, phases, rejected, type }) => [
      type,
      phases.sign,
      phases.confirm,
      done,
      rejected,
    ]),
  };
};

const deposit = yieldApiTransactionFixture({
  id: "deposit-tx",
  network: "ethereum",
  status: "CREATED",
  type: "DEPOSIT",
});

const prepare = (state: TransactionWorkflowState) =>
  attachPreparedClassicAction({
    context: state.context,
    prepared: makeClassicTransactionWorkflowInput({
      action: yieldApiActionFixture({
        address,
        transactions: [deposit],
        yieldId,
      }),
      inputToken: undefined,
      providersDetails: [],
      walletScope,
    }),
  });

describe("Classic Steps view", () => {
  it("lists the reset, approval, wrap and an idle deposit as soon as Steps opens", () => {
    const preparing = initializeTransactionWorkflow(
      makeInput([reset, approve, wrap])
    );

    expect(rows(preparing)).toEqual({
      // The API action's steps are known only once prepared, so no count.
      numbered: false,
      retryable: false,
      rows: [
        ["ENCRYPT", "active", "idle", false, false],
        ["RESET_APPROVAL", "idle", "idle", false, false],
        ["APPROVAL", "idle", "idle", false, false],
        ["WRAP", "idle", "idle", false, false],
        ["DEPOSIT", "idle", "idle", false, false],
      ],
    });
  });

  it("shows a wrap its Ledger confirmed as done", () => {
    const preparing = initializeTransactionWorkflow(
      makeInput([wrap]),
      new Map([
        [
          "conversion-wrap",
          { _tag: "Confirmed", hash: "0x01", transaction: wrap },
        ],
      ])
    );

    expect(rows(preparing).rows.slice(1, 2)).toEqual([
      ["WRAP", "done", "done", true, false],
    ]);
  });

  it("replaces the deposit placeholder with the prepared transactions", () => {
    const context = prepare(initializeTransactionWorkflow(makeInput([wrap])));

    expect(
      view({ _tag: "Signing", context }).txStates.map(({ id }) => id)
    ).toEqual(["prepare-encrypt", "conversion-wrap", "deposit-tx"]);
  });

  it("shows a preparation the API rejected as final", () => {
    const { context } = initializeTransactionWorkflow(makeInput([]));

    expect(
      rows({
        _tag: "PrepareFailed",
        context,
        error: new TransactionPrepareError({
          cause: null,
          message: "invalid",
          retryable: false,
          workflowId: TransactionWorkflowId.make("w"),
        }),
      })
    ).toMatchObject({
      retryable: false,
      rows: [
        ["ENCRYPT", "failed", "idle", false, true],
        ["DEPOSIT", "idle", "idle", false, false],
      ],
    });
  });

  it("offers Retry for a wrap whose confirmation failed after preparation", () => {
    const context = prepare(initializeTransactionWorkflow(makeInput([wrap])));

    expect(
      rows({
        _tag: "ConfirmationFailed",
        context,
        error: new TransactionConfirmationError({
          batchId: "classic",
          message: "receipt unavailable",
          network: "ethereum",
          transactionId: "conversion-wrap",
          workflowId: TransactionWorkflowId.make("w"),
        }),
      })
    ).toMatchObject({
      retryable: true,
      rows: [
        ["ENCRYPT", "done", "done", true, false],
        ["WRAP", "done", "failed", false, false],
        ["DEPOSIT", "idle", "idle", false, false],
      ],
    });
  });
});
