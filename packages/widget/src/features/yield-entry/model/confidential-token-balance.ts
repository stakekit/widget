import type BigNumber from "bignumber.js";
import { HashMap, Option } from "effect";
import {
  ConfidentialTokenBalanceKey,
  getConfidentialAssetToken,
  type RevealedBalances,
  sameTokenContract,
} from "../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { exactDecimal } from "../../../domain/finance/exact";
import type { Token } from "../../../domain/token/token";

/** The API cannot read a confidential asset's balance; the owner reveals it. */
export const isHiddenTokenBalance = (
  yieldDto: EarnYieldWithProvider | null,
  token: Token | null
) => {
  const asset = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
  return Boolean(asset && token && sameTokenContract(asset, token));
};

/** Confidential wrappers are unpriced; they convert 1:1 with the underlying. */
export const getYieldEntryPriceToken = (
  yieldDto: EarnYieldWithProvider | null,
  token: Token | null
) =>
  yieldDto && isHiddenTokenBalance(yieldDto, token) ? yieldDto.token : token;

type YieldEntryTokenBalance = Readonly<{
  readonly availableAmount: BigNumber | null;
  /** Confidential balance the owner has not revealed. */
  readonly hiddenTokenBalance: boolean;
  /** Confidential balance the owner revealed and may hide again. */
  readonly revealedTokenBalance: boolean;
}>;

export type YieldEntryTokenBalanceInput = Readonly<{
  readonly owner: string | null;
  /** Balance the API reports for a non-confidential token. */
  readonly publicAmount: BigNumber | null;
  readonly token: Token | null;
  readonly yield: EarnYieldWithProvider | null;
}>;

// Unrevealed balances stay unknown so an over-balance transfer cannot clamp to zero.
export const resolveYieldEntryTokenBalance = ({
  owner,
  publicAmount,
  token,
  values,
  yield: yieldDto,
}: YieldEntryTokenBalanceInput & {
  readonly values: RevealedBalances | null;
}): YieldEntryTokenBalance => {
  if (!token || !isHiddenTokenBalance(yieldDto, token)) {
    return {
      availableAmount: publicAmount,
      hiddenTokenBalance: false,
      revealedTokenBalance: false,
    };
  }
  const revealed =
    owner && values
      ? HashMap.get(
          values.tokenBalances,
          new ConfidentialTokenBalanceKey({ owner, token })
        )
      : Option.none();
  if (Option.isNone(revealed)) {
    return {
      availableAmount: null,
      hiddenTokenBalance: true,
      revealedTokenBalance: false,
    };
  }
  return {
    availableAmount: exactDecimal(revealed.value.toString()).shiftedBy(
      -token.decimals
    ),
    hiddenTokenBalance: false,
    revealedTokenBalance: true,
  };
};
