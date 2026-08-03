import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { EarnBalance } from "../../src/domain/schema/earn-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  getPendingActionStateKey,
  preparePendingActionRequestDto,
} from "../../src/domain/types/pending-action-request";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../src/features/portfolio/state";
import {
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  openPendingActionModal,
  reconcilePendingActionModalReceipt,
} from "../../src/features/position-details/model/classic-flow-actions";
import { dispatchPositionDetailsWorkflowAtom } from "../../src/features/position-details/state/classic-view";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";

const selectedYield = yieldApiYieldFixture();
const balance = Schema.decodeUnknownSync(EarnBalance)(
  yieldBalanceFixture({
    pendingActions: [
      {
        amount: "1",
        arguments: {
          fields: [
            {
              label: "Amount",
              maximum: "10",
              minimum: "0",
              name: "amount",
              required: true,
              type: "string",
            },
          ],
        },
        intent: "manage",
        passthrough: "claim-rewards",
        type: "CLAIM_REWARDS",
      },
    ],
    token: selectedYield.token,
    validators: [yieldApiValidatorFixture({ address: "validator-a" })],
  })
);
const pendingActionDto = balance.pendingActions[0]!;

describe("Position Details action model", () => {
  it("closes only the pending-action attempt acknowledged by Started", () => {
    const first = openPendingActionModal({
      input: { pendingActionDto, yieldBalance: balance },
      store: makePendingActionModalStore(),
    });
    if (first.state._tag !== "Open") {
      throw new Error("Expected an open first attempt");
    }

    const closed = reconcilePendingActionModalReceipt({
      receipt: { _tag: "Started", attemptId: first.state.attemptId },
      store: first,
    });
    expect(closed.state._tag).toBe("Closed");

    const reopened = openPendingActionModal({
      input: { pendingActionDto, yieldBalance: balance },
      store: closed,
    });
    expect(reopened.state._tag).toBe("Open");
    expect(
      reconcilePendingActionModalReceipt({
        receipt: { _tag: "Started", attemptId: first.state.attemptId },
        store: reopened,
      }).state._tag
    ).toBe("Open");
  });

  it("does not apply an automatic receipt to a different pending action", () => {
    const first = makeAutomaticPendingActionModalState({
      pendingActionDto,
      yieldBalance: balance,
    });
    const nextPendingAction = {
      ...pendingActionDto,
      passthrough: "different-pending-action",
    };
    const second = makeAutomaticPendingActionModalState({
      pendingActionDto: nextPendingAction,
      yieldBalance: balance,
    });
    if (first._tag !== "Open") {
      throw new Error("Expected an open first automatic attempt");
    }

    expect(
      reconcilePendingActionModalReceipt({
        receipt: { _tag: "Started", attemptId: first.attemptId },
        store: { ...makePendingActionModalStore(), state: second },
      }).state._tag
    ).toBe("Open");
  });

  it("keeps colliding server actions in independent amount slots", () => {
    const collisionBalance = Schema.decodeUnknownSync(EarnBalance)(
      yieldBalanceFixture({
        pendingActions: [
          {
            ...pendingActionDto,
            arguments: {
              fields: [
                {
                  label: "Amount",
                  maximum: "1",
                  minimum: "0",
                  name: "amount",
                  required: true,
                  type: "string",
                },
              ],
            },
          },
          {
            ...pendingActionDto,
            arguments: {
              fields: [
                {
                  label: "Amount",
                  maximum: "6",
                  minimum: "5",
                  name: "amount",
                  required: true,
                  type: "string",
                },
              ],
            },
            passthrough: "claim-rewards-second-tranche",
          },
        ],
        token: selectedYield.token,
      })
    );
    const firstPendingAction = collisionBalance.pendingActions[0]!;
    const secondPendingAction = collisionBalance.pendingActions[1]!;
    const firstKey = getPendingActionStateKey({
      actionType: firstPendingAction.type,
      balanceType: collisionBalance.type,
      passthrough: firstPendingAction.passthrough,
      token: collisionBalance.token,
    });
    const secondKey = getPendingActionStateKey({
      actionType: secondPendingAction.type,
      balanceType: collisionBalance.type,
      passthrough: secondPendingAction.passthrough,
      token: collisionBalance.token,
    });

    expect(firstKey).not.toBe(secondKey);

    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(collisionBalance.address),
      network: "ethereum",
    });
    const workflowKey = new PositionDetailsWorkflowKey({
      balanceId: "collision-balance",
      integrationId: selectedYield.id,
      pendingActionType: null,
      scope,
    });
    const positionKey = new PositionBalancesKey({
      balanceId: workflowKey.balanceId,
      scope,
      yieldId: selectedYield.id,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        [
          yieldOpportunityAtom(
            new YieldOpportunityKey({ yieldId: selectedYield.id })
          ),
          AsyncResult.success(selectedYield),
        ],
        [
          positionBalancesAtom(positionKey),
          AsyncResult.success({
            balances: [collisionBalance],
            rewardRate: null,
            type: "default" as const,
          }),
        ],
        [
          positionBalancesByTypeAtom(positionKey),
          AsyncResult.success(
            new Map([
              [
                collisionBalance.type,
                [
                  {
                    ...collisionBalance,
                    tokenPriceInUsd: new BigNumber(1),
                  },
                ],
              ],
            ])
          ),
        ],
      ],
    });

    registry.set(dispatchPositionDetailsWorkflowAtom(workflowKey), {
      data: {
        actionType: firstPendingAction.type,
        amount: new BigNumber(4),
        balanceType: collisionBalance.type,
        passthrough: firstPendingAction.passthrough,
        token: collisionBalance.token,
      },
      type: "pendingAction/amount/change",
    });
    registry.set(dispatchPositionDetailsWorkflowAtom(workflowKey), {
      data: {
        actionType: secondPendingAction.type,
        amount: new BigNumber(4),
        balanceType: collisionBalance.type,
        passthrough: secondPendingAction.passthrough,
        token: collisionBalance.token,
      },
      type: "pendingAction/amount/change",
    });
    const pendingActions = registry.get(
      positionDetailsWorkflowAtom(workflowKey)
    ).pendingActions;

    expect(pendingActions.get(firstKey)?.toString(10)).toBe("1");
    expect(pendingActions.get(secondKey)?.toString(10)).toBe("5");

    const prepared = preparePendingActionRequestDto({
      additionalAddresses: null,
      address: Schema.decodeSync(WalletAddress)(balance.address),
      integration: selectedYield,
      pendingActionDto: secondPendingAction,
      pendingActionsState: pendingActions,
      selectedValidators: [],
      yieldBalance: collisionBalance,
    });

    expect(Result.getOrThrow(prepared).requestDto).toMatchObject({
      arguments: { amount: "5" },
      passthrough: "claim-rewards-second-tranche",
    });

    registry.dispose();
  });
});
