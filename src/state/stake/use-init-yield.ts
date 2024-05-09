import { EitherAsync, Maybe } from "purify-ts";
import { getInitialYield } from "../../domain/types/stake";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSKQueryClient } from "../../providers/query-client";
import type { TokenDto } from "@stakekit/api-hooks";
import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import { getMultipleYields } from "../../hooks/api/use-multi-yields";
import { useTokenBalance } from "./use-token-balance";

export const useInitYield = ({
  selectedToken,
}: {
  selectedToken: Maybe<TokenDto>;
}) => {
  const { availableYields, availableAmount } = useTokenBalance({
    selectedToken,
  });
  const { isLedgerLive, isConnected, network } = useSKWallet();
  const queryClient = useSKQueryClient();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    staleTime: Infinity,
    queryKey: ["init-yield", isConnected, network, selectedToken.extract()],
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromRecord({ availableYields, availableAmount }).toEither(
            new Error("selected token is missing")
          )
        ).chain((val) =>
          getInitialQueryParams({
            isLedgerLive,
            queryClient,
            yieldYieldOpportunity,
          }).chain((initParams) =>
            getMultipleYields({
              isConnected,
              isLedgerLive,
              queryClient,
              yieldYieldOpportunity,
              network,
              yieldIds: val.availableYields,
            }).chain((multipleYields) =>
              EitherAsync.liftEither(
                getInitialYield({
                  initQueryParams: Maybe.fromNullable(initParams),
                  yieldDtos: multipleYields,
                  tokenBalanceAmount: val.availableAmount,
                }).toEither(new Error("could not get initial yield"))
              )
            )
          )
        )
      ).unsafeCoerce(),
  });
};
