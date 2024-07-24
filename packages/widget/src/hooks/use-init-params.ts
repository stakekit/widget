import type { TokenString } from "@sk-widget/domain/types";
import {
  type SettingsContextType,
  useSettings,
} from "@sk-widget/providers/settings";
import { ActionTypes, useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Codec, EitherAsync, Left, Right, string } from "purify-ts";
import {
  type SupportedSKChains,
  isSupportedChain,
} from "../domain/types/chains";
import type { InitParams } from "../domain/types/init-params";
import { useSKQueryClient } from "../providers/query-client";
import { useSKWallet } from "../providers/sk-wallet";
import { MaybeWindow } from "../utils/maybe-window";
import { getYieldOpportunity } from "./api/use-yield-opportunity";

const queryKey = ["init-params"];
const staleTime = 0;
const cacheTime = 0;

export const useInitParams = <T = InitParams>(opts?: {
  select: (val: InitParams) => T;
}) => {
  const { isLedgerLive } = useSKWallet();

  const { externalProviders } = useSettings();

  const queryClient = useSKQueryClient();

  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    queryKey,
    staleTime,
    gcTime: cacheTime,
    queryFn: () =>
      queryFn({
        isLedgerLive,
        queryClient,
        yieldYieldOpportunity,
        externalProviders,
      }),
    select: opts?.select,
  });
};

export const getInitParams = (
  params: Parameters<typeof fn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey,
      staleTime,
      gcTime: cacheTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get init query params");
  });

const queryFn = async (params: Parameters<typeof fn>[0]) =>
  (await fn(params)).unsafeCoerce();

export const getAndValidateInitParams = ({
  externalProviderInitToken,
}: { externalProviderInitToken?: TokenString }) =>
  MaybeWindow.map((w) => new URL(w.location.href)).map((url) => ({
    network: safeParamCodec
      .decode(url.searchParams.get("network"))
      .chain(skSupportedChainsCodec.decode)
      .toMaybe()
      .extractNullable(),
    token: safeParamCodec
      .decode(url.searchParams.get("token") ?? externalProviderInitToken)
      .toMaybe()
      .extractNullable(),
    yieldId: safeParamCodec
      .decode(url.searchParams.get("yieldId"))
      .chain(yieldIdCodec.decode)
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
    referralCode: safeParamCodec
      .decode(url.searchParams.get("ref"))
      .toMaybe()
      .extractNullable(),
    accountId: string // Not safeParamCodec as it maybe has ../ or ./
      .decode(url.searchParams.get("accountId"))
      .toMaybe()
      .extractNullable(),
    tab: safeParamCodec
      .decode(url.searchParams.get("tab"))
      .chain(tabCodec.decode)
      .toMaybe()
      .extractNullable(),
  }));

const fn = ({
  isLedgerLive,
  queryClient,
  yieldYieldOpportunity,
  externalProviders,
}: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
  externalProviders: SettingsContextType["externalProviders"];
}): EitherAsync<Error, InitParams> =>
  EitherAsync.liftEither(
    getAndValidateInitParams({
      externalProviderInitToken: externalProviders?.initToken,
    }).toEither(new Error("missing window"))
  )
    .map((val) => ({
      ...val,
      accountId: val.accountId ? decodeURIComponent(val.accountId) : null,
    }))
    .chain<Error, InitParams>((val) => {
      const yId = val.yieldId;

      if (yId) {
        return getYieldOpportunity({
          isLedgerLive,
          yieldId: yId,
          queryClient,
          yieldYieldOpportunity,
        })
          .map((yieldData) => ({
            ...val,
            network: yieldData.token.network as SupportedSKChains,
            token: yieldData.token.symbol,
            yieldData,
          }))
          .chainLeft(async () => Right({ ...val, yieldData: null }));
      }

      return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
    });

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

const pathTraversalRegEx = /(\.\.\/)|(\.\/)/;

const safeParamCodec = Codec.custom<string>({
  decode: (val) =>
    string
      .decode(val)
      .chain((v) =>
        pathTraversalRegEx.test(v) ? Left("invalid string value") : Right(v)
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
