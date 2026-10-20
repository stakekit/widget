import type BigNumber from "bignumber.js";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { equalTokens, type Token } from "../../../domain/token/token";

export type PositionStakeTokenOption = Readonly<{
  /** Balance the API reports; null when unknown or confidential. */
  readonly amount: BigNumber | null;
  /** Confidential balance only its owner can reveal. */
  readonly hiddenBalance: boolean;
  readonly selected: boolean;
  readonly token: Token;
}>;

/**
 * Tokens that can enter the yield, as the Earn page offers them: the yield
 * token first, then every input token the API accepts (for a confidential
 * vault, the confidential wrapper).
 */
export const getPositionStakeTokens = (
  yieldDto: EarnYieldWithProvider
): ReadonlyArray<Token> =>
  [yieldDto.token, ...yieldDto.inputTokens].filter(
    (token, index, tokens) =>
      tokens.findIndex((candidate) => equalTokens(candidate, token)) === index
  );

/** The chosen token while the yield still accepts it, else the yield token. */
export const resolvePositionStakeToken = (
  yieldDto: EarnYieldWithProvider,
  chosen: Token | null
): Token =>
  (chosen &&
    getPositionStakeTokens(yieldDto).find((token) =>
      equalTokens(token, chosen)
    )) ??
  yieldDto.token;
