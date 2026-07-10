import type BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import {
  type ActionCommand,
  type ActionTransaction,
  type ManageActionCommand,
  TransactionGasEstimateJson,
  type YieldAction,
} from "../schema/action-models";
import type { TokenDto } from "./tokens";
import type { Yield } from "./yields";

export type TransactionDto = Omit<ActionTransaction, "id"> & {
  readonly id: string;
};
export type ActionDto = Omit<
  YieldAction,
  "address" | "id" | "transactions" | "yieldId"
> & {
  readonly address: string;
  readonly id: string;
  readonly transactions: ReadonlyArray<TransactionDto>;
  readonly yieldId: string;
};
export type TransactionType = TransactionDto["type"];
export type ActionType = ActionDto["type"];
export type ActionStatus = ActionDto["status"];
export type TransactionStatus = TransactionDto["status"];

export type YieldCreateActionDto = typeof ActionCommand.Encoded;
export type YieldCreateManageActionDto = typeof ManageActionCommand.Encoded;
type TransactionGasEstimate = {
  amount: BigNumber;
  gasLimit?: string;
  token: TokenDto;
} | null;

export const ActionTypes = {
  STAKE: "STAKE",
  UNSTAKE: "UNSTAKE",
  WITHDRAW_REQUEST: "WITHDRAW_REQUEST",
  INSTANT_WITHDRAW: "INSTANT_WITHDRAW",
  CLAIM_REWARDS: "CLAIM_REWARDS",
  AUTO_SWEEP_UNSTAKE_REWARDS: "AUTO_SWEEP_UNSTAKE_REWARDS",
  AUTO_SWEEP_WITHDRAW_REWARDS: "AUTO_SWEEP_WITHDRAW_REWARDS",
  RESTAKE_REWARDS: "RESTAKE_REWARDS",
  WITHDRAW: "WITHDRAW",
  WITHDRAW_ALL: "WITHDRAW_ALL",
  RESTAKE: "RESTAKE",
  CLAIM_UNSTAKED: "CLAIM_UNSTAKED",
  UNLOCK_LOCKED: "UNLOCK_LOCKED",
  STAKE_LOCKED: "STAKE_LOCKED",
  VOTE: "VOTE",
  REVOKE: "REVOKE",
  VOTE_LOCKED: "VOTE_LOCKED",
  REVOTE: "REVOTE",
  REBOND: "REBOND",
  MIGRATE: "MIGRATE",
  VERIFY_WITHDRAW_CREDENTIALS: "VERIFY_WITHDRAW_CREDENTIALS",
  DELEGATE: "DELEGATE",
} as const satisfies Record<ActionType, ActionType>;

export const ActionStatus = {
  CANCELED: "CANCELED",
  CREATED: "CREATED",
  WAITING_FOR_NEXT: "WAITING_FOR_NEXT",
  PROCESSING: "PROCESSING",
  FAILED: "FAILED",
  SUCCESS: "SUCCESS",
  STALE: "STALE",
} as const satisfies Record<ActionStatus, ActionStatus>;

export const TransactionStatus = {
  NOT_FOUND: "NOT_FOUND",
  CREATED: "CREATED",
  BLOCKED: "BLOCKED",
  WAITING_FOR_SIGNATURE: "WAITING_FOR_SIGNATURE",
  SIGNED: "SIGNED",
  BROADCASTED: "BROADCASTED",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const satisfies Record<TransactionStatus, TransactionStatus>;

const NATIVE_TOKEN_PLACEHOLDER = "0x";

const toLower = (value: string) => value.toLowerCase();

export const getActionInputToken = ({
  actionDto,
  inputToken,
  yieldDto,
}: {
  actionDto: ActionDto;
  inputToken?: TokenDto;
  yieldDto?: Yield | null;
}): TokenDto | undefined => {
  if (inputToken) {
    return inputToken;
  }

  if (!yieldDto) {
    return undefined;
  }

  const inputTokenValue = actionDto.rawArguments?.inputToken;

  if (!inputTokenValue) {
    return yieldDto.token ?? yieldDto.tokens?.[0];
  }

  const needle = toLower(inputTokenValue);

  return (
    [yieldDto.token, ...(yieldDto.tokens ?? [])].find((token) => {
      const address = token.address ? toLower(token.address) : null;

      return (
        address === needle ||
        token.symbol.toLowerCase() === needle ||
        (needle === NATIVE_TOKEN_PLACEHOLDER && !token.address)
      );
    }) ??
    yieldDto.token ??
    yieldDto.tokens?.[0]
  );
};

export const getActionValidatorAddresses = (
  actionDto: ActionDto
): ReadonlyArray<string> | null =>
  actionDto.rawArguments?.validatorAddresses ??
  (actionDto.rawArguments?.validatorAddress
    ? [actionDto.rawArguments.validatorAddress]
    : null);

export const getTransactionGasEstimate = (
  transactionDto: TransactionDto
): TransactionGasEstimate =>
  transactionDto.gasEstimate
    ? Schema.decodeUnknownOption(TransactionGasEstimateJson)(
        transactionDto.gasEstimate
      ).pipe(Option.getOrNull)
    : null;
