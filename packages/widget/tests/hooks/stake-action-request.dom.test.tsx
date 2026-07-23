import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  EarnBalance,
  EarnValidator,
  type EarnYieldWithProvider,
} from "../../src/domain/schema/earn-models";
import { useStakeEnterRequestDto } from "../../src/features/earn/ui/classic/earn-page/state/use-stake-enter-request-dto";
import { useStakeExitRequestDto } from "../../src/features/position-details/ui/classic/hooks/use-stake-exit-request-dto";
import { yieldApiYieldFixture } from "../fixtures";
import { renderHook } from "../utils/test-utils.dom";

const wallet = vi.hoisted(() => ({
  additionalAddresses: null,
  address: "0xWallet",
  isLedgerLive: false,
}));

vi.mock("../../src/features/wallet/react/use-wallet", () => ({
  useSKWallet: () => wallet,
}));

type ActionFields = NonNullable<
  NonNullable<EarnYieldWithProvider["mechanics"]["arguments"]>["enter"]
>["fields"];

const actionFieldTypes = {
  subnetId: "string",
  validatorAddress: "address",
  validatorAddresses: "address",
} as const;

const actionField = <Name extends keyof typeof actionFieldTypes>(name: Name) =>
  ({
    name,
    required: true,
    type: actionFieldTypes[name],
  }) as NonNullable<ActionFields[Name]>;

const makeYield = ({
  enter = {},
  exit = {},
}: {
  enter?: ActionFields;
  exit?: ActionFields;
}) => {
  const value = yieldApiYieldFixture();

  return {
    ...value,
    mechanics: {
      ...value.mechanics,
      arguments: {
        enter: { fields: enter },
        exit: { fields: exit },
      },
    },
  } satisfies EarnYieldWithProvider;
};

const makeValidator = (subnetId?: number) =>
  Schema.decodeUnknownSync(EarnValidator)({
    address: "validator-1",
    ...(subnetId === undefined
      ? {}
      : { subnet: { id: subnetId, name: `Subnet ${subnetId}` } }),
  });

describe("stake action request construction", () => {
  it("omits subnetId when the enter action does not require it", async () => {
    const selectedStake = makeYield({
      enter: { validatorAddress: actionField("validatorAddress") },
    });
    const validator = makeValidator();

    const hook = await renderHook(() =>
      useStakeEnterRequestDto({
        selectedProviderYieldId: null,
        selectedStake,
        selectedToken: selectedStake.token,
        selectedValidators: new Map([[validator.key, validator]]),
        stakeAmount: new BigNumber(1),
        tronResource: null,
        useMaxAmount: false,
      })
    );

    expect(hook.result.current?.dto.arguments).toMatchObject({
      validatorAddress: validator.address,
    });
    expect(hook.result.current?.dto.arguments).not.toHaveProperty("subnetId");
  });

  it("blocks enter when a required subnetId is unavailable", async () => {
    const selectedStake = makeYield({
      enter: {
        subnetId: actionField("subnetId"),
        validatorAddress: actionField("validatorAddress"),
      },
    });
    const validator = makeValidator();

    const hook = await renderHook(() =>
      useStakeEnterRequestDto({
        selectedProviderYieldId: null,
        selectedStake,
        selectedToken: selectedStake.token,
        selectedValidators: new Map([[validator.key, validator]]),
        stakeAmount: new BigNumber(1),
        tronResource: null,
        useMaxAmount: false,
      })
    );

    expect(hook.result.current).toBeNull();
  });

  it("blocks exit when a required subnetId is unavailable", async () => {
    const integrationData = makeYield({
      exit: {
        subnetId: actionField("subnetId"),
        validatorAddress: actionField("validatorAddress"),
      },
    });
    const validator = makeValidator();
    const balance = Schema.decodeUnknownSync(EarnBalance)({
      address: wallet.address,
      amount: "1",
      amountRaw: "1",
      isEarning: true,
      pendingActions: [],
      token: integrationData.token,
      type: "active",
      validator,
    });

    const hook = await renderHook(() =>
      useStakeExitRequestDto({
        integrationData,
        stakedOrLiquidBalances: [
          { ...balance, tokenPriceInUsd: new BigNumber(1) },
        ],
        unstakeAmount: new BigNumber(1),
        unstakeUseMaxAmount: false,
      })
    );

    expect(hook.result.current).toBeNull();
  });
});
