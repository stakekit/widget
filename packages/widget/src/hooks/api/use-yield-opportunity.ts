import { yieldYieldOpportunity } from "@sk-widget/common/private-api";
import { useWhitelistedValidators } from "@sk-widget/hooks/use-whitelisted-validators";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useSKWallet } from "../../providers/sk-wallet";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  whitelistedValidatorAddresses: Set<string> | null;
  signal?: AbortSignal;
};

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];

export const useYieldOpportunity = (integrationId: string | undefined) => {
  const { isLedgerLive } = useSKWallet();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({ yieldId, isLedgerLive, whitelistedValidatorAddresses }),
    enabled: !!integrationId,
    staleTime,
    queryFn: ({ signal }) =>
      queryFn({ yieldId, isLedgerLive, signal, whitelistedValidatorAddresses }),
  });
};

export const getYieldOpportunity = (
  params: Params & {
    queryClient: QueryClient;
  }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getKey(params),
      staleTime,
      queryFn: ({ signal }) => queryFn({ ...params, signal }),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

const queryFn = async (
  params: Params & {
    signal?: AbortSignal;
  }
) => (await fn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  yieldId,
  signal,
  whitelistedValidatorAddresses,
}: Params & {
  signal?: AbortSignal;
}) =>
  EitherAsync(() =>
    yieldYieldOpportunity(
      yieldId,
      {
        ledgerWalletAPICompatible: isLedgerLive,
      },
      signal
    )
  )
    .map((y) =>
      whitelistedValidatorAddresses
        ? {
            ...y,
            validators: y.validators.filter((v) =>
              whitelistedValidatorAddresses.has(v.address)
            ),
          }
        : y
    )
    .mapLeft((e) => {
      console.log(e);
      return new Error("Could not get yield opportunity");
    });
