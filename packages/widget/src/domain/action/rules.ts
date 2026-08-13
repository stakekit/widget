import type BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import type { EarnYieldWithProvider } from "../earn/models";
import type { TokenAddress, ValidatorAddress } from "../identity/identifiers";
import type { Token } from "../token/token";
import {
  type ActionCommand,
  type ActionTransaction,
  TransactionGasEstimateJson,
  type YieldAction,
} from "./models";

export type TransactionType = ActionTransaction["type"];
export type ActionType = YieldAction["type"];
export type ActionStatus = YieldAction["status"];
export type TransactionStatus = ActionTransaction["status"];

export type ExitReceiveToken = Readonly<{
  readonly address: TokenAddress;
  readonly symbol: string;
}>;

export const getActionProviderYieldId = (
  command: Pick<ActionCommand, "arguments">
) => command.arguments?.providerId ?? null;
type TransactionGasEstimate = {
  amount: BigNumber;
  gasLimit?: string;
  token: Token;
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
  actionDto: YieldAction;
  inputToken?: Token;
  yieldDto?: EarnYieldWithProvider | null;
}): Token | undefined => {
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
  actionDto: YieldAction
): ReadonlyArray<ValidatorAddress> | null =>
  actionDto.rawArguments?.validatorAddresses ??
  (actionDto.rawArguments?.validatorAddress
    ? [actionDto.rawArguments.validatorAddress]
    : null);

export const getTransactionGasEstimate = (
  transactionDto: ActionTransaction
): TransactionGasEstimate =>
  transactionDto.gasEstimate
    ? Schema.decodeOption(TransactionGasEstimateJson)(
        transactionDto.gasEstimate
      ).pipe(Option.getOrNull)
    : null;
