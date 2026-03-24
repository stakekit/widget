import type { Networks } from "@stakekit/common";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import { getResponseData } from "../yield-api-client-provider/request-helpers";
import type { YieldApiFetchClient } from "../yield-api-client-provider/types";

export const getEnabledNetworks = ({
  queryClient,
  yieldApiFetchClient,
}: {
  queryClient: QueryClient;
  yieldApiFetchClient: YieldApiFetchClient;
}) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: [config.appPrefix, "enabled-networks"],
      queryFn: async () =>
        new Set(
          (await getResponseData(yieldApiFetchClient.GET("/v1/networks"))).map(
            (network) => network.id as Networks
          )
        ),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
