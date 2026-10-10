import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  getPendingActionStateKey,
  PendingActionStateKey,
  preparePendingActionCommand,
} from "../../src/domain/action/action-command";
import { EarnBalance } from "../../src/domain/earn/models";
import { Prices } from "../../src/domain/health/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { toPositionBalancesByType } from "../../src/domain/portfolio/positions";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  openPendingActionModal,
  reconcilePendingActionModalReceipt,
} from "../../src/features/position-details/model/classic-flow-actions";
import { resolvePositionDetailsExitReceiveTokenSelection } from "../../src/features/position-details/model/exit-receive-token";
import { resolvePositionDetailsActionCapabilities } from "../../src/features/position-details/model/hub";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsPendingActionsViewAtom,
  positionDetailsPricesAtom,
  positionDetailsWorkflowViewAtom,
} from "../../src/features/position-details/state/classic-view";
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
const balance = Schema.decodeSync(EarnBalance)(
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
  it("constructs opaque Pending Action state keys through the domain factory", () => {
    const key = getPendingActionStateKey({
      actionType: pendingAction.type,
      balanceType: balance.type,
      passthrough: pendingAction.passthrough,
      token: balance.token,
    });

    expect(Schema.is(PendingActionStateKey)(key)).toBe(true);
    expect(Schema.is(PendingActionStateKey)("")).toBe(false);
    expect(key).toContain(pendingAction.passthrough);
  });

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

  it.each([
    { name: "advertises no exit outputToken field", options: null },
    { name: "advertises an empty optional outputToken list", options: [] },
  ])(
    "does not enable receive-token selection when a yield $name",
    ({ options }) => {
      const baseYield = yieldApiYieldDtoFixture();
      const integration = yieldApiYieldFixture({
        mechanics: {
          ...baseYield.mechanics,
          arguments: {
            ...baseYield.mechanics.arguments,
            exit: {
              fields: options
                ? [
                    {
                      label: "Output Token",
                      name: "outputToken",
                      options,
                      required: false,
                      type: "string",
                    },
                  ]
                : [],
            },
          },
        },
      });

      expect(
        resolvePositionDetailsExitReceiveTokenSelection({
          integration,
          selectedAddress: null,
        })
      ).toBeNull();
    }
  );

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
    const collisionBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        pendingActions: [
          {
            amount: "1",
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
            intent: "manage",
            passthrough: "claim-rewards",
            type: "CLAIM_REWARDS",
          },
          {
            amount: "1",
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
            intent: "manage",
            passthrough: "claim-rewards-second-tranche",
            type: "CLAIM_REWARDS",
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

    expect(pendingActions.get(firstKey)?.toString(10)).toBe("4");
    expect(pendingActions.get(secondKey)?.toString(10)).toBe("4");
    expect(
      registry
        .get(positionDetailsPendingActionsViewAtom(workflowKey))
        ?.map(({ validation }) => validation)
    ).toEqual(["AboveMaximum", "BelowMinimum"]);

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
      arguments: { amount: "4" },
      passthrough: "claim-rewards-second-tranche",
    });

    registry.dispose();
  });

  it("offers exit only when the active balances hold exactly one token", () => {
    const usdt = {
      ...selectedYield.token,
      address: "0x0000000000000000000000000000000000000007",
      symbol: "USDT",
    };
    const active = (
      amount: string,
      token: NonNullable<
        Parameters<typeof yieldBalanceFixture>[0]
      >["token"] = selectedYield.token
    ) =>
      Schema.decodeSync(EarnBalance)(
        yieldBalanceFixture({
          amount,
          amountUsd: amount,
          token,
          type: "active",
        })
      );

    const singleToken = readWorkflowView("single-token", [
      active("1.25"),
      active("0.75"),
    ]);

    expect(singleToken.exitBalance?.amount.toFixed()).toBe("2");
    expect(singleToken.unstakeToken?.symbol).toBe(selectedYield.token.symbol);
    expect(singleToken.maxUnstakeAmount.toFixed()).toBe("2");
    expect(
      resolvePositionDetailsActionCapabilities({
        ...singleToken,
        canUnstake: true,
      }).canUnstake
    ).toBe(true);

    const twoTokens = readWorkflowView("two-tokens", [
      active("1.25"),
      active("10", usdt),
    ]);

    expect(twoTokens.exitBalance).toBeNull();
    expect(twoTokens.unstakeToken).toBeNull();
    expect(
      resolvePositionDetailsActionCapabilities({
        ...twoTokens,
        canUnstake: true,
      }).canUnstake
    ).toBe(false);
  });

  it("values each pending action with its own balance token", () => {
    const rewardToken = {
      ...selectedYield.token,
      address: "0x0000000000000000000000000000000000000008",
      symbol: "KMNO",
    };
    const activeBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        amount: "1",
        amountUsd: "2000",
        token: selectedYield.token,
        type: "active",
      })
    );
    const claimableBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        amount: "10",
        amountUsd: "5",
        pendingActions: [
          {
            amount: null,
            arguments: {
              fields: [
                {
                  label: "Amount",
                  name: "amount",
                  required: true,
                  type: "string",
                },
              ],
            },
            intent: "manage",
            passthrough: "claim-kmno",
            type: "CLAIM_REWARDS",
          },
        ],
        token: rewardToken,
        type: "claimable",
      })
    );
    const priceKey = (token: { network: string; address?: string }) =>
      `${token.network}-${token.address?.toLowerCase() ?? ""}`;
    const { registry, workflowKey } = makeWorkflowRegistry(
      "valuation",
      [activeBalance, claimableBalance],
      new Prices(
        new Map([
          [
            priceKey(selectedYield.token),
            { price: new BigNumber(2000), price24H: undefined },
          ],
          [
            priceKey(rewardToken),
            { price: new BigNumber(0.5), price24H: undefined },
          ],
        ])
      )
    );

    expect(
      registry
        .get(positionDetailsPendingActionsViewAtom(workflowKey))
        ?.map(({ formattedAmount }) => formattedAmount)
    ).toEqual(["$5.00"]);

    registry.dispose();
  });
});

const makeWorkflowRegistry = (
  balanceId: string,
  balances: ReadonlyArray<EarnBalance>,
  prices: Prices = new Prices(new Map())
) => {
  const scope = new WalletScopeKey({
    address: Schema.decodeSync(WalletAddress)(balance.address),
    network: "ethereum",
  });
  const workflowKey = new PositionDetailsWorkflowKey({
    balanceId,
    integrationId: selectedYield.id,
    pendingActionType: null,
    scope,
  });
  const positionKey = new PositionBalancesKey({
    balanceId,
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
          balances: [...balances],
          rewardRate: null,
          type: "default" as const,
        }),
      ],
      [
        positionBalancesByTypeAtom(positionKey),
        AsyncResult.success(toPositionBalancesByType(balances)),
      ],
      [positionDetailsPricesAtom(workflowKey), AsyncResult.success(prices)],
    ],
  });

  return { registry, workflowKey };
};

const readWorkflowView = (
  balanceId: string,
  balances: ReadonlyArray<EarnBalance>
) => {
  const { registry, workflowKey } = makeWorkflowRegistry(balanceId, balances);
  const view = registry.get(positionDetailsWorkflowViewAtom(workflowKey));
  registry.dispose();
  return view;
};
