import { Option, Schema } from "effect";
import { isFundedBalance } from "../../../../../domain/finance/funded-balance";
import { YieldId } from "../../../../../domain/identity/identifiers";
import { hostTokenKey, tokenString } from "../../../../../domain/token/token";
import type { EarnEntry, EarnTokenKey, EarnTokenOption } from "../types";

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

  const fundedToken = tokenOptions.find(
    (option) =>
      option.amount !== null &&
      isFundedBalance({ amount: option.amount, priceUsd: null })
  );
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
 * Matches `${network}-${address}` first: it is the only unique reference.
 * A symbol needs the network and is not unique even then (Ethereum lists both
 * `USDA` and `USDa`), so the exact symbol wins over a case-insensitive one.
 */
const findTokenByInitToken = ({
  network,
  token,
  tokenOptions,
}: {
  network: string | null;
  token: string;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) => {
  const hostKey = token.toLowerCase();
  const onNetwork = tokenOptions.filter(
    (option) =>
      !!network && network.toLowerCase() === option.token.network.toLowerCase()
  );

  return (
    tokenOptions.find((option) => hostTokenKey(option.token) === hostKey) ??
    onNetwork.find((option) => option.token.symbol === token) ??
    onNetwork.find((option) => option.token.symbol.toLowerCase() === hostKey) ??
    null
  );
};
