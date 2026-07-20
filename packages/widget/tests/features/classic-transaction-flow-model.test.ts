import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../src/domain/schema/action-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  abandonClassicTransactionFlow,
  attachClassicTransactionFlowAction,
  type ClassicTransactionFlow,
  type ClassicTransactionFlowIdentity,
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowActionPreviewInput,
  getClassicTransactionFlowGasWarningInput,
  getClassicTransactionFlowReviewPricingInput,
  getClassicTransactionFlowVariant,
  getClassicTransactionFlowWorkflowHandoff,
  isClassicTransactionFlowWalletScopeValid,
  makeClassicTransactionFlowIdentity,
  returnClassicTransactionFlowToReview,
  startClassicTransactionFlow,
} from "../../src/features/transaction-flow/model/classic-transaction-flow";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { classicFlowIdentityFixture } from "../utils/classic-flow";

const identity = classicFlowIdentityFixture;
const address = (value: string) => Schema.decodeSync(WalletAddress)(value);

const walletScope = new WalletScopeKey({
  address: address("0x1234567890123456789012345678901234567890"),
  network: "ethereum",
});

const makeIntakes = () => {
  const integration = yieldApiYieldFixture();
  const action = yieldApiActionFixture();
  const providersDetails = [{ name: "StakeKit" }];
  const enterCommand = {
    address: walletScope.address,
    arguments: { amount: "12.5" },
    yieldId: integration.id,
  } as ActionCommand;
  const exitCommand = {
    address: walletScope.address,
    arguments: { amount: "4" },
    yieldId: integration.id,
  } as ActionCommand;
  const manageCommand = {
    address: walletScope.address,
    yieldId: integration.id,
  } as ManageActionCommand;

  return {
    action,
    enter: {
      _tag: "Enter",
      gasFeeToken: integration.mechanics.gasFeeToken,
      providersDetails,
      request: enterCommand,
      selectedStake: integration,
      selectedToken: integration.token,
      selectedValidators: new Map(),
      walletScope,
    } satisfies ClassicTransactionFlowIntake,
    exit: {
      _tag: "Exit",
      gasFeeToken: integration.mechanics.gasFeeToken,
      integration,
      providersDetails,
      request: exitCommand,
      unstakeAmount: new BigNumber(4),
      unstakeToken: integration.token,
      walletScope,
    } satisfies ClassicTransactionFlowIntake,
    manage: {
      _tag: "Manage",
      gasFeeToken: integration.mechanics.gasFeeToken,
      integration,
      interactedToken: integration.token,
      pendingActionType: "CLAIM_REWARDS",
      providersDetails,
      request: manageCommand,
      walletScope,
    } satisfies ClassicTransactionFlowIntake,
    activityResume: {
      _tag: "ActivityResume",
      action,
      providersDetails,
      selectedValidators: [],
      selectedYield: integration,
      walletScope,
    } satisfies ClassicTransactionFlowIntake,
    integration,
  };
};

const attach = (
  flow: ClassicTransactionFlow,
  flowIdentity: ClassicTransactionFlowIdentity,
  action = yieldApiActionFixture()
) => {
  const result = attachClassicTransactionFlowAction(flow, flowIdentity, action);
  expect(result._tag).toBe("Attached");
  if (result._tag !== "Attached") throw new Error("expected attachment");
  return result.activeFlow;
};

describe("Classic Transaction Flow core", () => {
  it("rejects malformed Classic Transaction Flow identities", () => {
    expect(() => makeClassicTransactionFlowIdentity("not-a-uuid")).toThrow();
  });

  it.each([
    ["Enter", "Reviewing"],
    ["Exit", "Reviewing"],
    ["Manage", "Reviewing"],
    ["ActivityResume", "Executable"],
  ] as const)("starts %s in %s", (variant, phase) => {
    const intakes = makeIntakes();
    const intake =
      variant === "ActivityResume"
        ? intakes.activityResume
        : variant === "Enter"
          ? intakes.enter
          : variant === "Exit"
            ? intakes.exit
            : intakes.manage;

    const flow = startClassicTransactionFlow(null, identity("flow-1"), intake);

    expect(flow).toMatchObject({
      _tag: variant,
      phase,
      identity: identity("flow-1"),
    });
  });

  it("atomically replaces the previous variant and snapshots mutable collections", () => {
    const intakes = makeIntakes();
    const first = startClassicTransactionFlow(
      null,
      identity("flow-1"),
      intakes.enter
    );
    const second = startClassicTransactionFlow(
      first,
      identity("flow-2"),
      intakes.activityResume
    );

    intakes.enter.providersDetails.push({ name: "late provider" });
    intakes.enter.selectedValidators.set(
      "late-validator" as never,
      {} as never
    );

    expect(second).toMatchObject({
      _tag: "ActivityResume",
      identity: identity("flow-2"),
      phase: "Executable",
    });
    expect(first.providersDetails).toHaveLength(1);
    expect(
      first._tag === "Enter" ? first.selectedValidators.size : undefined
    ).toBe(0);
  });

  it("attaches exactly one action without validating its content against intake", () => {
    const intakes = makeIntakes();
    const flowIdentity = identity("flow-1");
    const reviewing = startClassicTransactionFlow(
      null,
      flowIdentity,
      intakes.enter
    );
    const unrelatedAction = yieldApiActionFixture({
      type: "UNSTAKE",
      yieldId: "different-yield",
    });

    const first = attachClassicTransactionFlowAction(
      reviewing,
      flowIdentity,
      unrelatedAction
    );
    expect(first).toMatchObject({
      _tag: "Attached",
      activeFlow: { action: unrelatedAction, phase: "Executable" },
    });
    if (first._tag !== "Attached") throw new Error("expected attachment");

    const second = attachClassicTransactionFlowAction(
      first.activeFlow,
      flowIdentity,
      yieldApiActionFixture()
    );
    expect(second).toEqual({
      _tag: "NotReviewing",
      activeFlow: first.activeFlow,
    });
  });

  it("returns typed stale transitions and leaves state unchanged", () => {
    const intakes = makeIntakes();
    const active = startClassicTransactionFlow(
      null,
      identity("current"),
      intakes.exit
    );

    expect(
      attachClassicTransactionFlowAction(
        active,
        identity("stale"),
        intakes.action
      )
    ).toEqual({ _tag: "StaleFlow", activeFlow: active });
    expect(
      attachClassicTransactionFlowAction(
        null,
        identity("stale"),
        intakes.action
      )
    ).toEqual({ _tag: "StaleFlow", activeFlow: null });
    expect(abandonClassicTransactionFlow(active, identity("stale"))).toEqual({
      _tag: "StaleFlow",
      activeFlow: active,
    });
    expect(abandonClassicTransactionFlow(active, identity("current"))).toEqual({
      _tag: "Abandoned",
      activeFlow: null,
    });
  });

  it.each([
    "Enter",
    "Exit",
    "Manage",
  ] as const)("Back from executable %s starts a fresh Reviewing identity with the same facts", (variant) => {
    const intakes = makeIntakes();
    const oldIdentity = identity("old");
    const intake =
      variant === "Enter"
        ? intakes.enter
        : variant === "Exit"
          ? intakes.exit
          : intakes.manage;
    const executable = attach(
      startClassicTransactionFlow(null, oldIdentity, intake),
      oldIdentity,
      intakes.action
    );

    const result = returnClassicTransactionFlowToReview(
      executable,
      oldIdentity,
      identity("fresh")
    );

    expect(result).toMatchObject({
      _tag: "ReviewingStarted",
      activeFlow: {
        ...intake,
        identity: identity("fresh"),
        phase: "Reviewing",
      },
    });
    if (result._tag !== "ReviewingStarted") {
      throw new Error("expected fresh review");
    }
    expect("action" in result.activeFlow).toBe(false);
  });

  it("retains Activity Resume identity and action on Back", () => {
    const intakes = makeIntakes();
    const active = startClassicTransactionFlow(
      null,
      identity("activity"),
      intakes.activityResume
    );

    const result = returnClassicTransactionFlowToReview(
      active,
      identity("activity"),
      identity("unused")
    );

    expect(result).toEqual({
      _tag: "ActivityResumeRetained",
      activeFlow: active,
    });
  });

  it("rejects Back from Reviewing, stale identity, and reused replacement identity", () => {
    const intakes = makeIntakes();
    const flowIdentity = identity("flow");
    const reviewing = startClassicTransactionFlow(
      null,
      flowIdentity,
      intakes.manage
    );
    const executable = attach(reviewing, flowIdentity, intakes.action);

    expect(
      returnClassicTransactionFlowToReview(
        reviewing,
        flowIdentity,
        identity("fresh")
      )
    ).toEqual({ _tag: "NotExecutable", activeFlow: reviewing });
    expect(
      returnClassicTransactionFlowToReview(
        executable,
        identity("stale"),
        identity("fresh")
      )
    ).toEqual({ _tag: "StaleFlow", activeFlow: executable });
    expect(
      returnClassicTransactionFlowToReview(
        executable,
        flowIdentity,
        flowIdentity
      )
    ).toEqual({ _tag: "IdentityNotReplaced", activeFlow: executable });
  });
});

describe("Classic Transaction Flow projections", () => {
  it.each([
    ["Enter", "enter"],
    ["Exit", "exit"],
    ["Manage", "manage"],
  ] as const)("projects %s Action-preview identity and command", (variant, intent) => {
    const intakes = makeIntakes();
    const intake =
      variant === "Enter"
        ? intakes.enter
        : variant === "Exit"
          ? intakes.exit
          : intakes.manage;
    const flow = startClassicTransactionFlow(null, identity("preview"), intake);

    expect(getClassicTransactionFlowActionPreviewInput(flow)).toEqual({
      command: intake.request,
      flowIdentity: identity("preview"),
      intent,
    });
  });

  it("does not preview Activity Resume or an already Executable flow", () => {
    const intakes = makeIntakes();
    const flowIdentity = identity("flow");
    const activity = startClassicTransactionFlow(
      null,
      flowIdentity,
      intakes.activityResume
    );
    const executable = attach(
      startClassicTransactionFlow(null, flowIdentity, intakes.enter),
      flowIdentity,
      intakes.action
    );

    expect(getClassicTransactionFlowActionPreviewInput(activity)).toBeNull();
    expect(getClassicTransactionFlowActionPreviewInput(executable)).toBeNull();
  });

  it.each([
    "Enter",
    "Exit",
    "Manage",
    "ActivityResume",
  ] as const)("projects normalized pricing and gas inputs for %s", (variant) => {
    const intakes = makeIntakes();
    const intake =
      variant === "Enter"
        ? intakes.enter
        : variant === "Exit"
          ? intakes.exit
          : variant === "Manage"
            ? intakes.manage
            : intakes.activityResume;
    const flow = startClassicTransactionFlow(
      null,
      identity("projection"),
      intake
    );

    const prices = getClassicTransactionFlowReviewPricingInput(flow);
    const gas = getClassicTransactionFlowGasWarningInput(flow);

    expect(prices?.yield).toBe(intakes.integration);
    expect(prices?.token).toBe(intakes.integration.token);
    expect(gas).toMatchObject({
      gasFeeToken: intakes.integration.mechanics.gasFeeToken,
      walletScope,
    });
    expect(gas?.stakeAmount?.toString() ?? null).toBe(
      variant === "Enter" ? "12.5" : null
    );
    expect(gas?.stakeToken ?? null).toBe(
      variant === "Enter" ? intakes.integration.token : null
    );
  });

  it("validates Wallet Scope by network and primary owner only", () => {
    const intakes = makeIntakes();
    const flow = startClassicTransactionFlow(
      null,
      identity("scope"),
      intakes.enter
    );
    const casingAndAdditionalAddressChange = new WalletScopeKey({
      address: address(walletScope.address.toUpperCase()),
      additionalAddresses: { cosmosPubKey: "different" },
      network: "ethereum",
    });

    expect(
      isClassicTransactionFlowWalletScopeValid(
        flow,
        casingAndAdditionalAddressChange
      )
    ).toBe(true);
    expect(
      isClassicTransactionFlowWalletScopeValid(
        flow,
        new WalletScopeKey({
          address: address("0x9999999999999999999999999999999999999999"),
          network: "ethereum",
        })
      )
    ).toBe(false);
    expect(
      isClassicTransactionFlowWalletScopeValid(
        flow,
        new WalletScopeKey({
          address: walletScope.address,
          network: "polygon",
        })
      )
    ).toBe(false);
    expect(isClassicTransactionFlowWalletScopeValid(flow, null)).toBe(false);
  });

  it("returns narrow variants and only Executable workflow handoffs", () => {
    const intakes = makeIntakes();
    const flowIdentity = identity("handoff");
    const reviewing = startClassicTransactionFlow(
      null,
      flowIdentity,
      intakes.exit
    );
    const executable = attach(reviewing, flowIdentity, intakes.action);

    expect(getClassicTransactionFlowVariant(reviewing, "Exit")).toBe(reviewing);
    expect(getClassicTransactionFlowVariant(reviewing, "Enter")).toBeNull();
    expect(getClassicTransactionFlowWorkflowHandoff(reviewing)).toBeNull();
    expect(getClassicTransactionFlowWorkflowHandoff(executable)).toMatchObject({
      flowIdentity: identity("handoff"),
      workflowKey: {
        actionMeta: { actionId: intakes.action.id },
        walletScope,
        yieldId: intakes.action.yieldId,
      },
    });
  });

  it("is deterministic for the same injected identity and intake", () => {
    const intakes = makeIntakes();
    const flowIdentity = identity("deterministic");

    expect(
      startClassicTransactionFlow(null, flowIdentity, intakes.enter)
    ).toEqual(startClassicTransactionFlow(null, flowIdentity, intakes.enter));
  });
});
