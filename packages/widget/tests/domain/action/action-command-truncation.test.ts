import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  getPendingActionStateKey,
  preparePendingActionCommand,
} from "../../../src/domain/action/action-command";
import { EarnBalance } from "../../../src/domain/earn/balance";
import type { EarnYield } from "../../../src/domain/earn/yield-schema";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { projectYieldEntry } from "../../../src/features/yield-entry/model/yield-entry";
import {
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

// Enter amounts project against a 6-decimal token with a balance of 2.
const projectEnter = (
  amount: string,
  selectedYield: EarnYield = yieldApiYieldFixture()
) =>
  projectYieldEntry({
    input: {
      amountInitialization: "PreserveIntent",
      availableAmount: new BigNumber("2"),
      campaign: null,
      connected: true,
      entry: {
        amount: new BigNumber(amount),
        selectedProviderOption: null,
        token: { ...selectedYield.token, decimals: 6 },
        tronResource: null,
        useMaxAmount: false,
        validators: new Map(),
        yield: selectedYield,
      },
      externalProviders: false,
      hasNoYields: false,
      isKycBlocking: false,
      isKycLoading: false,
      isLedgerAccountPlaceholder: false,
      readiness: { _tag: "Ready" },
      selectedYieldHasActivePosition: false,
      providers: null,
      validateAmount: true,
      wallet: {
        additionalAddresses: null,
        address,
        isLedgerLive: false,
      },
    },
    submitted: false,
  });

describe("executable token amount truncation", () => {
  it("truncates excess Enter precision and rejects dust that becomes zero", () => {
    expect(
      projectEnter("1.123456789").preparation?.command.arguments?.amount
    ).toBe("1.123456");
    expect(projectEnter("0.0000001").validation.errors.stakeAmountIsZero).toBe(
      true
    );
  });

  it("rejects Enter amounts that fall below the minimum after truncation", () => {
    const selectedYield = yieldApiYieldFixture({
      mechanics: {
        ...yieldApiYieldDtoFixture().mechanics,
        arguments: {
          enter: {
            fields: [
              {
                label: "Amount",
                minimum: "1.123457",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
          exit: { fields: [] },
        },
      },
    });
    const view = projectEnter("1.123456789", selectedYield);

    expect(view.preparation?.command.arguments?.amount).toBe("1.123456");
    expect(view.validation.errors.stakeAmountLessThanMin).toBe(true);
  });

  it("preserves a high-precision Pending Action amount through Manage command construction", () => {
    const integration = yieldApiYieldFixture();
    const preciseAmount = "1.123456789012345678";
    const pendingActionEncoded = {
      intent: "manage" as const,
      passthrough: "claim",
      type: "CLAIM_REWARDS" as const,
      arguments: {
        fields: [
          {
            label: "Amount",
            maximum: preciseAmount,
            minimum: "0.1",
            name: "amount" as const,
            required: true,
            type: "string" as const,
          },
        ],
      },
    };
    const yieldBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: preciseAmount,
        pendingActions: [pendingActionEncoded],
        token: integration.token,
        type: "claimable",
      })
    );
    const pendingAction = yieldBalance.pendingActions[0]!;
    const amount = new BigNumber(preciseAmount);
    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address,
      integration,
      pendingAction,
      pendingActionsState: new Map([
        [
          getPendingActionStateKey({
            actionType: pendingAction.type,
            balanceType: yieldBalance.type,
            passthrough: pendingAction.passthrough,
            token: yieldBalance.token,
          }),
          amount,
        ],
      ]),
      selectedValidators: [],
      yieldBalance,
    });

    expect(Result.getOrThrow(prepared).command.arguments?.amount).toBe(
      preciseAmount
    );
  });

  it("truncates a Pending Action amount to the token's base unit", () => {
    const integration = yieldApiYieldFixture();
    const token = { ...integration.token, decimals: 6 };
    const yieldBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "2",
        pendingActions: [
          {
            intent: "manage" as const,
            passthrough: "claim",
            type: "CLAIM_REWARDS" as const,
            arguments: {
              fields: [
                {
                  label: "Amount",
                  maximum: "2",
                  minimum: "0.1",
                  name: "amount" as const,
                  required: true,
                  type: "string" as const,
                },
              ],
            },
          },
        ],
        token,
        type: "claimable",
      })
    );
    const pendingAction = yieldBalance.pendingActions[0]!;
    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address,
      integration,
      pendingAction,
      pendingActionsState: new Map([
        [
          getPendingActionStateKey({
            actionType: pendingAction.type,
            balanceType: yieldBalance.type,
            passthrough: pendingAction.passthrough,
            token,
          }),
          new BigNumber("1.123456789"),
        ],
      ]),
      selectedValidators: [],
      yieldBalance: { ...yieldBalance, token },
    });
    const commandAmount = Result.getOrThrow(prepared).command.arguments?.amount;

    expect(commandAmount).toBe("1.123456");
  });

  it("rejects a Manage amount that truncates below one base unit", () => {
    const integration = yieldApiYieldFixture();
    const token = { ...integration.token, decimals: 6 };
    const yieldBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "1",
        pendingActions: [
          {
            intent: "manage" as const,
            passthrough: "claim",
            type: "CLAIM_REWARDS" as const,
            arguments: {
              fields: [
                {
                  label: "Amount",
                  maximum: "1",
                  minimum: "0.1",
                  name: "amount" as const,
                  required: true,
                  type: "string" as const,
                },
              ],
            },
          },
        ],
        token,
        type: "claimable",
      })
    );
    const pendingAction = yieldBalance.pendingActions[0]!;
    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address,
      integration,
      pendingAction,
      pendingActionsState: new Map([
        [
          getPendingActionStateKey({
            actionType: pendingAction.type,
            balanceType: yieldBalance.type,
            passthrough: pendingAction.passthrough,
            token: yieldBalance.token,
          }),
          new BigNumber("0.0000001"),
        ],
      ]),
      selectedValidators: [],
      yieldBalance: { ...yieldBalance, token },
    });

    expect(Result.isFailure(prepared)).toBe(true);
  });

  it("sends no amount for a Pending Action that takes none, whatever its balance holds", () => {
    // One withdrawable balance carries a WITHDRAW per stake account, each
    // with its own amount in its passthrough; the balance is their sum.
    const integration = yieldApiYieldFixture();
    const yieldBalance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        address,
        amount: "0.023218103",
        pendingActions: [
          {
            amount: "0.00264645",
            arguments: {
              fields: [
                {
                  label: "Receiver Address",
                  name: "receiverAddress" as const,
                  required: false,
                  type: "string" as const,
                },
              ],
            },
            intent: "manage" as const,
            passthrough: "withdraw-stake-account",
            type: "WITHDRAW" as const,
          },
        ],
        type: "withdrawable",
      })
    );
    const prepared = preparePendingActionCommand({
      additionalAddresses: null,
      address,
      integration,
      pendingAction: yieldBalance.pendingActions[0]!,
      pendingActionsState: new Map(),
      selectedValidators: [],
      yieldBalance,
    });

    expect(Result.getOrThrow(prepared).command.arguments).toEqual({});
    expect(Result.getOrThrow(prepared).amount?.amount.toFixed()).toBe(
      "0.00264645"
    );
  });
});
