import { Option, Schema } from "effect";
import { useMemo } from "react";
import {
  type WalletInitQueryParams,
  WalletInitQueryParams as WalletInitQueryParamsSchema,
} from "../domain/schema/wallet-models";
import type { TokenString } from "../domain/types/tokens";
import { useSettings } from "../providers/settings";

export const useInitQueryParams = (): WalletInitQueryParams | null => {
  const { externalProviders } = useSettings();

  return useMemo(
    () =>
      getAndValidateInitParams({
        externalProviderInitToken: externalProviders?.initToken,
      }),
    [externalProviders?.initToken]
  );
};

const decodeAccountId = (value: string | null) => {
  if (value === null) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const getTokenNetwork = (value: string | null) => {
  if (!value?.includes("-")) return null;

  return value.split("-").slice(0, -1).join("-");
};

const decodeField = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown
): S["Type"] | null =>
  Schema.decodeUnknownOption(schema)(value).pipe(Option.getOrNull);

const getAndValidateInitParams = ({
  externalProviderInitToken,
}: {
  readonly externalProviderInitToken?: TokenString;
}): WalletInitQueryParams | null => {
  const url = new URL(window.location.href);
  const token =
    url.searchParams.get("token") ?? externalProviderInitToken ?? null;
  const requestedNetwork = url.searchParams.get("network");
  const network = decodeField(
    WalletInitQueryParamsSchema.fields.network,
    requestedNetwork ?? getTokenNetwork(token)
  );

  return {
    accountId: decodeAccountId(url.searchParams.get("accountId")),
    balanceId: decodeField(
      WalletInitQueryParamsSchema.fields.balanceId,
      url.searchParams.get("balanceId")
    ),
    network,
    pendingaction: decodeField(
      WalletInitQueryParamsSchema.fields.pendingaction,
      url.searchParams.get("pendingaction")
    ),
    tab: decodeField(
      WalletInitQueryParamsSchema.fields.tab,
      url.searchParams.get("tab")
    ),
    token,
    validator: url.searchParams.get("validator"),
    yieldId: decodeField(
      WalletInitQueryParamsSchema.fields.yieldId,
      url.searchParams.get("yieldId")
    ),
  };
};
