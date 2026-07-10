import BigNumber from "bignumber.js";
import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import type { CollateralToken } from "./collateral-token";
import { IntegrationId, MarketId, TokenAddress, WalletAddress } from "./ids";
import type { Market } from "./market";

type AmountValue = BigNumber | number | string;

type BorrowFormInput = {
  readonly borrowAmount: AmountValue;
  readonly collateralAmount: AmountValue;
  readonly selectedCollateralToken: CollateralToken | null;
  readonly selectedMarket: Market | null;
};

type BorrowFormBase = {
  readonly selectedMarket: Market;
};

export type BorrowPlusCollateralForm = BorrowFormBase & {
  readonly _tag: "BorrowPlusCollateral";
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly selectedCollateralToken: CollateralToken;
};

export type BorrowOnlyForm = BorrowFormBase & {
  readonly _tag: "BorrowOnly";
  readonly borrowAmount: BigNumber;
};

export type CollateralOnlyForm = BorrowFormBase & {
  readonly _tag: "CollateralOnly";
  readonly collateralAmount: BigNumber;
  readonly selectedCollateralToken: CollateralToken;
};

export type DecodedBorrowForm =
  | BorrowPlusCollateralForm
  | BorrowOnlyForm
  | CollateralOnlyForm;

export const ActionRequest = Schema.Struct({
  ...BorrowApi.ActionRequestDto.fields,
  integrationId: IntegrationId,
  address: WalletAddress,
  args: Schema.Struct({
    ...BorrowApi.ActionRequestDto.fields.args.fields,
    marketId: MarketId,
    tokenAddress: Schema.optionalKey(TokenAddress),
    collateralTokenAddress: Schema.optionalKey(TokenAddress),
  }),
});
export type ActionRequest = typeof ActionRequest.Type;

const makeActionRequest = Schema.decodeUnknownSync(ActionRequest);

type BaseActionRequestInput = {
  readonly address: WalletAddress | string;
  readonly integrationId: IntegrationId | string;
  readonly marketId: MarketId | string;
};

type RepayActionRequestInput = BaseActionRequestInput &
  (
    | {
        readonly amount: AmountValue;
        readonly repayAll?: false;
      }
    | {
        readonly amount?: never;
        readonly repayAll: true;
      }
  ) & {
    readonly tokenAddress?: TokenAddress | string;
  };

type WithdrawActionRequestInput = BaseActionRequestInput & {
  readonly amount: AmountValue;
  readonly tokenAddress?: TokenAddress | string;
};

type CollateralToggleActionRequestInput = BaseActionRequestInput & {
  readonly action: "enableCollateral" | "disableCollateral";
  readonly tokenAddress?: TokenAddress | string;
};

const toAmount = (amount: AmountValue) => new BigNumber(amount);

const toActionAmount = (amount: AmountValue) => toAmount(amount).toString(10);

const tokenAddressArg = (tokenAddress: string | undefined) =>
  tokenAddress ? { tokenAddress } : {};

const collateralTokenAddressArg = (tokenAddress: string | undefined) =>
  tokenAddress ? { collateralTokenAddress: tokenAddress } : {};

export const decodeBorrowForm = (
  input: BorrowFormInput
): DecodedBorrowForm | null => {
  if (!input.selectedMarket) {
    return null;
  }

  const borrowAmount = toAmount(input.borrowAmount);
  const collateralAmount = toAmount(input.collateralAmount);
  const hasBorrowAmount = borrowAmount.gt(0);
  const hasCollateralAmount = collateralAmount.gt(0);

  if (hasBorrowAmount && hasCollateralAmount && input.selectedCollateralToken) {
    return {
      _tag: "BorrowPlusCollateral",
      borrowAmount,
      collateralAmount,
      selectedCollateralToken: input.selectedCollateralToken,
      selectedMarket: input.selectedMarket,
    };
  }

  if (hasBorrowAmount) {
    return {
      _tag: "BorrowOnly",
      borrowAmount,
      selectedMarket: input.selectedMarket,
    };
  }

  if (hasCollateralAmount && input.selectedCollateralToken) {
    return {
      _tag: "CollateralOnly",
      collateralAmount,
      selectedCollateralToken: input.selectedCollateralToken,
      selectedMarket: input.selectedMarket,
    };
  }

  return null;
};

export const isDecodedBorrow = (
  form: DecodedBorrowForm
): form is BorrowOnlyForm | BorrowPlusCollateralForm =>
  form._tag === "BorrowOnly" || form._tag === "BorrowPlusCollateral";

export const isDecodedCollateral = (
  form: DecodedBorrowForm
): form is CollateralOnlyForm | BorrowPlusCollateralForm =>
  form._tag === "CollateralOnly" || form._tag === "BorrowPlusCollateral";

export const buildBorrowActionRequest = ({
  address,
  form,
  integrationId = form.selectedMarket.integrationId,
}: {
  readonly address: WalletAddress | string;
  readonly form: DecodedBorrowForm;
  readonly integrationId?: IntegrationId | string;
}): ActionRequest => {
  if (form._tag === "CollateralOnly") {
    return makeActionRequest({
      action: "supply",
      address,
      args: {
        amount: toActionAmount(form.collateralAmount),
        marketId: form.selectedMarket.id,
        ...tokenAddressArg(form.selectedCollateralToken.token.address),
      },
      integrationId,
    });
  }

  return makeActionRequest({
    action: "borrow",
    address,
    args: {
      amount: toActionAmount(form.borrowAmount),
      marketId: form.selectedMarket.id,
      ...tokenAddressArg(form.selectedMarket.loanToken.address),
      ...(form._tag === "BorrowPlusCollateral"
        ? {
            collateralAmount: toActionAmount(form.collateralAmount),
            ...collateralTokenAddressArg(
              form.selectedCollateralToken.token.address
            ),
          }
        : {}),
    },
    integrationId,
  });
};

export const buildRepayActionRequest = ({
  address,
  amount,
  integrationId,
  marketId,
  repayAll,
  tokenAddress,
}: RepayActionRequestInput): ActionRequest =>
  makeActionRequest({
    action: "repay",
    address,
    args: {
      marketId,
      ...(repayAll
        ? { repayAll: true }
        : {
            amount: toActionAmount(amount),
          }),
      ...tokenAddressArg(tokenAddress),
    },
    integrationId,
  });

export const buildWithdrawActionRequest = ({
  address,
  amount,
  integrationId,
  marketId,
  tokenAddress,
}: WithdrawActionRequestInput): ActionRequest =>
  makeActionRequest({
    action: "withdraw",
    address,
    args: {
      amount: toActionAmount(amount),
      marketId,
      ...tokenAddressArg(tokenAddress),
    },
    integrationId,
  });

export const buildCollateralToggleActionRequest = ({
  action,
  address,
  integrationId,
  marketId,
  tokenAddress,
}: CollateralToggleActionRequestInput): ActionRequest =>
  makeActionRequest({
    action,
    address,
    args: {
      marketId,
      ...tokenAddressArg(tokenAddress),
    },
    integrationId,
  });
