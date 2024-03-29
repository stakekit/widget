import { EitherAsync, Right } from "purify-ts";
import { waitForMs } from "../utils";
import { QueryKey, useQuery } from "@tanstack/react-query";

export const useRefetchQueryNTimes = ({
  key,
  shouldRefetch,
  enabled,
  refetch,
  waitMs = 4000,
  times = 2,
}: {
  key: QueryKey;
  enabled: boolean;
  shouldRefetch: () => boolean;
  refetch: () => Promise<unknown>;
  waitMs?: number;
  times?: number;
}) => {
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
            await refetch();
          }).chainLeft(async () => Right(null))
        )
      );

      return null;
    },
  });
};
