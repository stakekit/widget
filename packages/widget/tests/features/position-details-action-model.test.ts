import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  getPendingActionStateKey,
  preparePendingActionCommand,
} from "../../src/domain/action/action-command";
import { EarnBalance } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  openPendingActionModal,
  reconcilePendingActionModalReceipt,
} from "../../src/features/position-details/model/classic-flow-actions";
import { resolvePositionDetailsExitReceiveTokenSelection } from "../../src/features/position-details/model/exit-receive-token";
import { dispatchPositionDetailsWorkflowAtom } from "../../src/features/position-details/state/classic-view";
import {
  PositionDetailsWorkflowKey,
  positionDetailsWorkflowAtom,
} from "../../src/features/position-details/state/workflow";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../src/resources/yield-positions/yield-positions";
import {
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

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
const pendingAction = balance.pendingActions[0]!;

describe("Position Details action model", () => {
  it("defaults an eligible Sky Savings Rate exit to USDS", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const usds = {
      ...baseYield.token,
      address: "0x1111111111111111111111111111111111111111",
      name: "USDS",
      symbol: "USDS",
    };
    const usdc = {
      ...baseYield.token,
      address: "0x2222222222222222222222222222222222222222",
      name: "USD Coin",
      symbol: "USDC",
    };
    const skySavingsRate = yieldApiYieldFixture({
      id: "sky-savings-rate-from-decoded-fields",
      inputTokens: [usds, usdc],
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          ...baseYield.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: [
                  "0x1111111111111111111111111111111111111111",
                  "0x2222222222222222222222222222222222222222",
                ],
                required: false,
                type: "string",
              },
            ],
          },
        },
      },
      outputToken: {
        ...baseYield.token,
        address: "0x3333333333333333333333333333333333333333",
        name: "Savings USDS",
        symbol: "sUSDS",
      },
      providerId: "sky",
      token: usds,
      tokens: [usds],
    });

    expect(
      resolvePositionDetailsExitReceiveTokenSelection({
        integration: skySavingsRate,
        selectedAddress: null,
      })
    ).toEqual({
      options: [
        {
          address: "0x1111111111111111111111111111111111111111",
          symbol: "USDS",
        },
        {
          address: "0x2222222222222222222222222222222222222222",
          symbol: "USDC",
        },
      ],
      selected: {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "USDS",
      },
    });
  });

  it("does not enable receive-token selection for another yield", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const otherSkySavingsRoute = yieldApiYieldFixture({
      id: "ethereum-usds-oav-sky-savings-rate",
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          ...baseYield.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: [
                  "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
                  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                ],
                type: "string",
              },
            ],
          },
        },
      },
    });

    expect(
      resolvePositionDetailsExitReceiveTokenSelection({
        integration: otherSkySavingsRoute,
        selectedAddress: null,
      })
    ).toBeNull();
  });

  it("uses every receive token advertised by Sky Savings Rate", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const usds = {
      ...baseYield.token,
      address: "0x1111111111111111111111111111111111111111",
      name: "USDS",
      symbol: "USDS",
    };
    const incompleteSkySavingsRate = yieldApiYieldFixture({
      inputTokens: [usds],
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          ...baseYield.mechanics.arguments,
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: ["0x1111111111111111111111111111111111111111"],
                type: "string",
              },
            ],
          },
        },
      },
      outputToken: {
        ...baseYield.token,
        address: "0x3333333333333333333333333333333333333333",
        name: "Savings USDS",
        symbol: "sUSDS",
      },
      providerId: "sky",
      token: usds,
      tokens: [usds],
    });

    expect(
      resolvePositionDetailsExitReceiveTokenSelection({
        integration: incompleteSkySavingsRate,
        selectedAddress: null,
      })
    ).toEqual({
      options: [
        {
          address: "0x1111111111111111111111111111111111111111",
          symbol: "USDS",
        },
      ],
      selected: {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "USDS",
      },
    });
  });

  it("closes only the pending-action attempt acknowledged by Started", () => {
    const first = openPendingActionModal({
      input: { pendingAction, yieldBalance: balance },
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
      input: { pendingAction, yieldBalance: balance },
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
      pendingAction,
      yieldBalance: balance,
    });
    const nextPendingAction = {
      ...pendingAction,
      passthrough: "different-pending-action",
    };
    const second = makeAutomaticPendingActionModalState({
      pendingAction: nextPendingAction,
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
            ...pendingAction,
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
            ...pendingAction,
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
        applicationRuntimeInitInitialValue(),
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

    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address: Schema.decodeSync(WalletAddress)(balance.address),
      integration: selectedYield,
      pendingAction: secondPendingAction,
      pendingActionsState: pendingActions,
      selectedValidators: [],
      yieldBalance: collisionBalance,
    });

    expect(Result.getOrThrow(prepared).command).toMatchObject({
      arguments: { amount: "5" },
      passthrough: "claim-rewards-second-tranche",
    });

    registry.dispose();
  });
});
