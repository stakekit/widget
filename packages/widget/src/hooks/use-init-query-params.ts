import { ActionTypes } from "@stakekit/api-hooks";
import { Codec, Left, Right, string } from "purify-ts";
import { useMemo } from "react";
import {
  type SupportedSKChains,
  isSupportedChain,
} from "../domain/types/chains";
import type { TokenString } from "../domain/types/tokens";
import { useSettings } from "../providers/settings";
import { MaybeWindow } from "../utils/maybe-window";

export const useInitQueryParams = () => {
  const { externalProviders } = useSettings();

  return useMemo(
    () =>
      getAndValidateInitParams({
        externalProviderInitToken: externalProviders?.initToken,
      }),
    [externalProviders?.initToken]
  );
};

const pendingActionCodec = Codec.custom<ActionTypes>({
  decode: (val) =>
    string
      .decode(val)
      .chain((v) =>
        v in ActionTypes
          ? Right(v as ActionTypes)
          : Left("invalid pending action")
      ),
  encode: (val) => val,
});

const skSupportedChainsCodec = Codec.custom<SupportedSKChains>({
  decode: (val) =>
    string
      .decode(val)
      .chain((v) => (isSupportedChain(v) ? Right(v) : Left("invalid chain"))),
  encode: (val) => val,
});

const safeString = /^(?!.*\.\.)[a-zA-Z0-9-_.+]*$/;

const safeParamCodec = Codec.custom<string>({
  decode: (val) =>
    string
      .decode(val)
      .chain((v) =>
        safeString.test(v) ? Right(v) : Left("invalid string value")
      ),
  encode: (val) => val,
});

const yieldIdCodec = Codec.custom<string>({
  decode: (val) =>
    string.decode(val).chain((v) => {
      const [network, token, ...yieldName] = v.split("-");

      if (!network || !token || !yieldName.toString()) {
        return Left("invalid yieldId format");
      }

      return Right(v);
    }),
  encode: (val) => val,
});

const tabCodec = Codec.custom<"earn" | "positions">({
  decode: (val) =>
    val === "earn" || val === "positions" ? Right(val) : Left("invalid chain"),
  encode: (val) => val,
});

const accountIdCodec = Codec.custom<string>({
  decode: (val) => string.decode(val).map((v) => decodeURIComponent(v)),
  encode: (val) => val,
});

export const getAndValidateInitParams = ({
  externalProviderInitToken,
}: { externalProviderInitToken?: TokenString }) =>
  MaybeWindow.map((w) => new URL(w.location.href)).map((url) => ({
    network: safeParamCodec
      .decode(url.searchParams.get("network"))
      .alt(
        safeParamCodec.decode(url.searchParams.get("token")).chain((val) =>
          val.includes("-")
            ? Right(val.split("-").slice(0, -1).join("-")) // network is first part of TokenString
            : Left("invalid TokenString")
        )
      )
      .chain(skSupportedChainsCodec.decode)
      .toMaybe()
      .extractNullable(),
    token: string // Not safeParamCodec as it maybe has some extra special characters
      .decode(url.searchParams.get("token") ?? externalProviderInitToken)
      .toMaybe()
      .extractNullable(),
    yieldId: safeParamCodec
      .decode(url.searchParams.get("yieldId"))
      .chain(yieldIdCodec.decode)
      .toMaybe()
      .extractNullable(),
    balanceId: safeParamCodec
      .decode(url.searchParams.get("balanceId"))
      .toMaybe()
      .extractNullable(),
    validator: string // Not safeParamCodec as it maybe has ../ or ./
      .decode(url.searchParams.get("validator"))
      .toMaybe()
      .extractNullable(),
    pendingaction: safeParamCodec
      .decode(url.searchParams.get("pendingaction"))
      .chain(pendingActionCodec.decode)
      .toMaybe()
      .extractNullable(),
    accountId: accountIdCodec // Not safeParamCodec as it maybe has ../ or ./
      .decode(url.searchParams.get("accountId"))
      .toMaybe()
      .extractNullable(),
    tab: safeParamCodec
      .decode(url.searchParams.get("tab"))
      .chain(tabCodec.decode)
      .toMaybe()
      .extractNullable(),
  }));
