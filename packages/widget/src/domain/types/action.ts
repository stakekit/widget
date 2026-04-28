import type BigNumber from "bignumber.js";
import type { components } from "../../types/yield-api-schema";
import type { TokenDto } from "./tokens";
import { getYieldMetadataTokens, type Yield } from "./yields";
export type ActionDto = components["schemas"]["ActionDto"];
export type TransactionDto = components["schemas"]["TransactionDto"];
export type TransactionType = TransactionDto["type"];
export type ActionType = ActionDto["type"];
export type ActionStatus = ActionDto["status"];
export type TransactionStatus = TransactionDto["status"];
export type ActionInputToken = TokenDto;

export type YieldActionArgumentsDto =
  components["schemas"]["ActionArgumentsDto"];
export type YieldCreateActionDto = components["schemas"]["CreateActionDto"];
export type YieldCreateManageActionDto =
  components["schemas"]["CreateManageActionDto"];
export type YieldActionDto = ActionDto;
export type YieldTransactionDto = TransactionDto;
export type TransactionGasEstimate = {
  amount: string;
  gasLimit?: string;
  token: TokenDto;
} | null;

export const ActionTypes = {
  STAKE: "STAKE",
  UNSTAKE: "UNSTAKE",
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

type EncodedGasEstimate = {
  amount?: string | null;
  gasLimit?: string | null;
  token?: TokenDto | null;
};

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
    [
      yieldDto.token,
      ...(yieldDto.tokens ?? []),
      ...getYieldMetadataTokens(yieldDto),
    ].find((token) => {
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
): string[] | null =>
  actionDto.rawArguments?.validatorAddresses ??
  (actionDto.rawArguments?.validatorAddress
    ? [actionDto.rawArguments.validatorAddress]
    : null);

export const getActionCurrentStepIndex = (actionDto: ActionDto) => {
  const idx = actionDto.transactions.findIndex(
    (transaction) =>
      transaction.status !== TransactionStatus.CONFIRMED &&
      transaction.status !== TransactionStatus.SKIPPED
  );

  if (idx >= 0) {
    return idx;
  }

  return Math.max(actionDto.transactions.length - 1, 0);
};

export const getTransactionGasEstimate = (
  transactionDto: TransactionDto
): TransactionGasEstimate => {
  const gasEstimate = transactionDto.gasEstimate;

  if (!gasEstimate) {
    return null;
  }

  try {
    const parsed = JSON.parse(gasEstimate) as EncodedGasEstimate | null;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const amount = parsed.amount ?? null;
    const token = parsed.token;

    if (!amount || !token) {
      return null;
    }

    return {
      amount,
      token,
    };
  } catch {
    return null;
  }
};

export const getActionGasFeeToken = (
  yieldDto: Yield,
  gasFeeToken?: TokenDto
): TokenDto => gasFeeToken ?? yieldDto.mechanics.gasFeeToken;

export type ActionDtoWithGasEstimate = {
  gasEstimate: {
    amount: BigNumber;
    token: TokenDto;
    gasLimit?: string;
  } | null;
};
