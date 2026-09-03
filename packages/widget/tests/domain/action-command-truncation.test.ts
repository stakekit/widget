import BigNumber from "bignumber.js";
import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  getPendingActionStateKey,
  preparePendingActionCommand,
} from "../../src/domain/action/action-command";
import { YieldAction } from "../../src/domain/action/models";
import { EarnBalance } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { projectYieldEntry } from "../../src/features/yield-entry/model/yield-entry";
import { defaultFormattedNumber } from "../../src/shared/lib/number-format";
import {
  yieldApiActionDtoFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

describe("executable token amount truncation", () => {
  it("decodes Yield Action amounts from number and string wire forms", () => {
    const fromNumber = Schema.decodeSync(YieldAction)(
      yieldApiActionDtoFixture({
        amount: 1.5,
        amountRaw: 1_500_000,
        amountUsd: 3,
      })
    );
    const fromString = Schema.decodeSync(YieldAction)(
      yieldApiActionDtoFixture({
        amount: "1.5",
        amountRaw: "1500000",
        amountUsd: "3",
      })
    );

    expect(fromNumber.amount?.isEqualTo(fromString.amount ?? 0)).toBe(true);
    expect(fromNumber.amountRaw).toBe(fromString.amountRaw);
    expect(fromNumber.amountUsd?.isEqualTo(fromString.amountUsd ?? 0)).toBe(
      true
    );
  });

  it("keeps Enter amounts already within token precision", () => {
    const selectedYield = yieldApiYieldFixture();
    const view = projectYieldEntry({
      input: {
        additionalValidationErrors: undefined,
        amountInitialization: "PreserveIntent",
        availableAmount: new BigNumber("1.5"),
        connected: true,
        entry: {
          amount: new BigNumber("1.5"),
          selectedProviderYieldId: null,
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

    expect(view.preparation?.command.arguments?.amount).toBe("1.5");
    expect(view.validation.hasErrors).toBe(false);
  });

  it("truncates excess Enter precision and rejects dust that becomes zero", () => {
    const selectedYield = yieldApiYieldFixture();
    const token = { ...selectedYield.token, decimals: 6 };
    const truncated = projectYieldEntry({
      input: {
        additionalValidationErrors: undefined,
        amountInitialization: "PreserveIntent",
        availableAmount: new BigNumber("2"),
        connected: true,
        entry: {
          amount: new BigNumber("1.123456789"),
          selectedProviderYieldId: null,
          token,
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
    const dust = projectYieldEntry({
      input: {
        additionalValidationErrors: undefined,
        amountInitialization: "PreserveIntent",
        availableAmount: new BigNumber("2"),
        connected: true,
        entry: {
          amount: new BigNumber("0.0000001"),
          selectedProviderYieldId: null,
          token,
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

    expect(truncated.preparation?.command.arguments?.amount).toBe("1.123456");
    expect(dust.validation.errors.stakeAmountIsZero).toBe(true);
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
    const view = projectYieldEntry({
      input: {
        additionalValidationErrors: undefined,
        amountInitialization: "PreserveIntent",
        availableAmount: new BigNumber("2"),
        connected: true,
        entry: {
          amount: new BigNumber("1.123456789"),
          selectedProviderYieldId: null,
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

  it("Review and Complete represent the truncated Action Command amount", () => {
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
    expect(defaultFormattedNumber(commandAmount ?? "0")).toBe("1.123456");
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
});
