import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { projectYieldEntry } from "../../../src/features/yield-entry/model/yield-entry";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

const yieldWithMinimum = (minimum: string) => {
  const base = yieldApiYieldDtoFixture();

  return yieldApiYieldFixture({
    mechanics: {
      ...base.mechanics,
      arguments: {
        ...base.mechanics.arguments,
        enter: {
          fields: [
            {
              label: "Amount",
              name: "amount",
              required: true,
              type: "string",
              minimum,
            },
          ],
        },
      },
    },
  });
};

/** The Earn form before the user typed anything: no amount, not validated. */
const projectUntyped = ({
  availableAmount,
  connected = true,
  minimum = "1",
}: {
  readonly availableAmount: BigNumber | null;
  readonly connected?: boolean;
  readonly minimum?: string;
}) => {
  const selectedYield = yieldWithMinimum(minimum);

  return projectYieldEntry({
    input: {
      amountInitialization: "PreserveIntent",
      availableAmount,
      connected,
      entry: {
        amount: new BigNumber(0),
        selectedProviderOption: null,
        token: selectedYield.token,
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
      validateAmount: false,
      wallet: {
        additionalAddresses: null,
        address: connected ? address : null,
        isLedgerLive: false,
      },
    },
    submitted: false,
  });
};

describe("Yield entry balance warning", () => {
  it("flags a balance below the minimum before any amount is typed", () => {
    const view = projectUntyped({ availableAmount: new BigNumber("0.7689") });

    expect(view.balanceWarning).toEqual({
      _tag: "BelowMinimum",
      minimum: new BigNumber("1"),
    });
  });

  it("flags an empty balance before any amount is typed", () => {
    const view = projectUntyped({
      availableAmount: new BigNumber(0),
      minimum: "0",
    });

    expect(view.balanceWarning).toEqual({ _tag: "NoBalance" });
  });

  it("disables the call to action as short of the token while the balance cannot fund an entry", () => {
    const view = projectUntyped({ availableAmount: new BigNumber("0.7689") });

    expect(view.cta).toMatchObject({
      _tag: "Submit",
      blocker: "InsufficientBalance",
      disabled: true,
    });
  });
});
