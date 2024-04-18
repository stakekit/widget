import { EitherAsync, Right } from "purify-ts";
import { waitForMs } from "../utils";
import type { QueryKey } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useSKQueryClient } from "../providers/query-client";

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
        Array.from({ length: 2 }).map(() =>
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
