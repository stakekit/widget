import type { QueryKey } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import { useSKQueryClient } from "../providers/query-client";
import { waitForMs } from "../utils";

export const useInvalidateQueryNTimes = ({
  key,
  shouldRefetch,
  enabled,
  queryKey,
  waitMs = 4000,
  times = 2,
}: {
  key: QueryKey;
  enabled: boolean;
  shouldRefetch: () => boolean;
  queryKey: QueryKey;
  waitMs?: number;
  times?: number;
}) => {
  const queryClient = useSKQueryClient();

  useQuery({
    queryKey: ["refetch-n-times", ...key],
    refetchOnMount: false,
    enabled,
    queryFn: async () => {
      if (!shouldRefetch()) {
        return null;
      }

      await EitherAsync.sequence(
        Array.from({ length: times }).map(() =>
          EitherAsync(async () => {
            await waitForMs(waitMs);
            await queryClient.invalidateQueries({ queryKey });
          }).chainLeft(async () => Right(null))
        )
      );

      return null;
    },
  });
};
