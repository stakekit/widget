import {
  type SettingsContextType,
  useSettings,
} from "@sk-widget/providers/settings";
import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
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
    MaybeWindow.map((w) => new URL(w.location.href))
      .map((url) => ({
        network: skSupportedChainsCodec
          .decode(url.searchParams.get("network"))
          .toMaybe()
          .extractNullable(),
        token: string
          .decode(url.searchParams.get("token") ?? externalProviders?.initToken)
          .toMaybe()
          .extractNullable(),
        yieldId: string
          .decode(url.searchParams.get("yieldId"))
          .toMaybe()
          .extractNullable(),
        validator: string
          .decode(url.searchParams.get("validator"))
          .toMaybe()
          .extractNullable(),
        pendingaction: string
          .decode(url.searchParams.get("pendingaction"))
          .toMaybe()
          .extractNullable(),
        referralCode: string
          .decode(url.searchParams.get("ref"))
          .toMaybe()
          .extractNullable(),
        accountId: string
          .decode(url.searchParams.get("accountId"))
          .toMaybe()
          .extractNullable(),
        tab: tabCodec
          .decode(url.searchParams.get("tab"))
          .toMaybe()
          .extractNullable(),
      }))
      .toEither(new Error("missing window"))
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
        }).map((yieldData) => ({
          ...val,
          network: yieldData.token.network as SupportedSKChains,
          token: yieldData.token.symbol,
          yieldData,
        }));
      }

      return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
    });

const skSupportedChainsCodec = Codec.custom<SupportedSKChains>({
  decode: (val) =>
    typeof val === "string" && isSupportedChain(val)
      ? Right(val)
      : Left("invalid chain"),
  encode: (val) => val,
});

const tabCodec = Codec.custom<"earn" | "positions">({
  decode: (val) =>
    val === "earn" || val === "positions" ? Right(val) : Left("invalid chain"),
  encode: (val) => val,
});
