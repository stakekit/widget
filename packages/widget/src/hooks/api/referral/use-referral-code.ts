import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { EitherAsync, Maybe } from "purify-ts";
import { useApiClient } from "../../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../../providers/query-client";
import { useSettings } from "../../../providers/settings";
import { setStorageItem } from "../../../services/local-storage";
import { useGetLatestReferralCode } from "./use-get-latest-referral-code";

const queryKey = ["referral-code"];

export const useReferralCode = () => {
  const latestReferralCode = useGetLatestReferralCode();

  const { referralCheck } = useSettings();

  const apiClient = useApiClient();

  return useQuery({
    queryKey,
    enabled: !latestReferralCode.isPending && !!referralCheck,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(latestReferralCode.data).toEither(
            new Error("missing referral code")
          )
        ).chain((referralCode) => fn({ referralCode, apiClient }))
      ).unsafeCoerce(),
  });
};

export const useValidateReferralCode = () => {
  const queryClient = useSKQueryClient();

  const apiClient = useApiClient();

  return useMutation({
    mutationFn: async (referralCode: string) =>
      (await fn({ referralCode, apiClient })).unsafeCoerce(),
    onSuccess: (data) => {
      setStorageItem("sk-widget@1//referralCode", data.code);
      queryClient.setQueryData(queryKey, data);
    },
  });
};

const fn = ({
  apiClient,
  referralCode,
}: {
  referralCode: string;
  apiClient: ReturnType<typeof useApiClient>;
}) =>
  EitherAsync(() =>
    apiClient.get<{ id: string; code: string }>(`/v1/referrals/${referralCode}`)
  )
    .map((res) => res.data)
    .mapLeft((err) => (isAxiosError(err) ? err : new Error("unknown error")));
