import { Networks, QueryClient, yieldGetMyNetworks } from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";

export const getEnabledNetworks = (queryClient: QueryClient) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Infinity,
      queryKey: [config.appPrefix, "enabled-networks"],
      queryFn: async () =>
        (
          await EitherAsync(() => yieldGetMyNetworks()).map(
            (v) => new Set(v as Networks[])
          )
        ).unsafeCoerce(),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
