import { Option, Schema } from "effect";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { YieldId } from "../../../../../domain/identity/identifiers";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import { hostTokenKey, tokenString } from "../../../../../domain/token/token";
import type { InitToken } from "../../../../../services/wallet/init-params";
import type {
  EarnEntry,
  EarnEntryIntent,
  EarnTokenKey,
  EarnTokenOption,
} from "../types";
import { isReachableDefaultYield, resolveYieldOptions } from "./yield";

/**
 * The tokens a default selection may land on, in their listed order: the
 * funded ones with a wallet (largest first), every token without one.
 */
export const defaultTokenCandidates = (
  entry: EarnEntry,
  tokenOptions: ReadonlyArray<EarnTokenOption>
) =>
  entry.walletScope
    ? tokenOptions.filter((option) => option.funded)
    : tokenOptions;

/**
 * Whether the Earn selection is the one picked for the user: no token or
 * yield chosen by the user, seeded by init params or preferred by the host.
 */
export const isDefaultTokenChoice = (
  entry: EarnEntry,
  intent: EarnEntryIntent
) => {
  const network = entry.walletScope?.network ?? null;
  const hostPreferred = network
    ? entry.preferredTokenYieldsPerNetwork?.[network]
    : Object.values(entry.preferredTokenYieldsPerNetwork ?? {})[0];
  return (
    intent.selectedTokenKey === null &&
    intent.selectedYieldId === null &&
    !intent.seededSelection &&
    !entry.initParams?.token &&
    !entry.initParams?.yieldId &&
    !hostPreferred
  );
};

/**
 * The first default candidate with a yield the user can reach; `yields`
 * holds the yields of every candidate.
 */
export const findReachableDefaultToken = ({
  entry,
  positions,
  tokenOptions,
  yields,
}: {
  readonly entry: EarnEntry;
  readonly positions: PositionsData;
  readonly tokenOptions: ReadonlyArray<EarnTokenOption>;
  readonly yields: ReadonlyArray<EarnYieldWithProvider>;
}) =>
  defaultTokenCandidates(entry, tokenOptions).find((option) =>
    resolveYieldOptions({ selectedToken: option, yieldsById: yields }).some(
      (yieldOption) =>
        isReachableDefaultYield({
          availableAmount: option.amount,
          positions,
          yieldOption,
        })
    )
  ) ?? null;

export const resolveToken = ({
  entry,
  previousToken = null,
  selectedTokenKey,
  tokenOptions,
}: {
  entry: EarnEntry;
  previousToken?: EarnTokenOption | null;
  selectedTokenKey: EarnTokenKey | null;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) => {
  if (selectedTokenKey) {
    const selected = findTokenByKey(tokenOptions, selectedTokenKey);
    if (selected) {
      return selected;
    }
  }

  if (entry.initParams?.yieldId) {
    const initYieldId = Schema.decodeOption(YieldId)(
      entry.initParams.yieldId
    ).pipe(Option.getOrNull);
    const selected = tokenOptions.find((option) =>
      initYieldId ? option.availableYields.includes(initYieldId) : false
    );
    if (selected) {
      return selected;
    }
  }

  if (entry.initParams?.token) {
    const selected = findTokenByInitToken({
      network: entry.initParams.network ?? null,
      token: entry.initParams.token,
      tokenOptions,
    });
    if (selected) {
      return selected;
    }
  }

  if (previousToken) {
    const selected = findTokenByKey(
      tokenOptions,
      tokenString(previousToken.token)
    );
    if (selected) {
      return selected;
    }
  }

  const network = entry.walletScope?.network ?? null;
  const preferredTokens = network
    ? entry.preferredTokenYieldsPerNetwork?.[network]
    : Object.values(entry.preferredTokenYieldsPerNetwork ?? {})[0];
  if (preferredTokens) {
    const selected = tokenOptions.find(
      (option) => !!preferredTokens[hostTokenKey(option.token)]
    );
    if (selected) {
      return selected;
    }
  }

  // Ranked by the balance's value, so the first funded one is the largest.
  const fundedToken = tokenOptions.find((option) => option.funded);
  if (fundedToken) {
    return fundedToken;
  }

  return tokenOptions[0] ?? null;
};

const findTokenByKey = (
  tokens: ReadonlyArray<EarnTokenOption>,
  tokenKey: EarnTokenKey
) => tokens.find((token) => tokenString(token.token) === tokenKey) ?? null;

/**
 * A host key identifies one token. A symbol needs the network and is not
 * unique even then (Ethereum lists both `USDA` and `USDa`), so the exact
 * symbol wins over a case-insensitive one.
 */
const findTokenByInitToken = ({
  network,
  token,
  tokenOptions,
}: {
  network: string | null;
  token: InitToken;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) => {
  if (token._tag === "HostKey") {
    return (
      tokenOptions.find((option) => hostTokenKey(option.token) === token.key) ??
      null
    );
  }

  const onNetwork = tokenOptions.filter(
    (option) => option.token.network === network
  );
  const symbol = token.symbol.toLowerCase();

  return (
    onNetwork.find((option) => option.token.symbol === token.symbol) ??
    onNetwork.find((option) => option.token.symbol.toLowerCase() === symbol) ??
    null
  );
};
