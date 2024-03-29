import { useMutation, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { APIManager } from "@stakekit/api-hooks";
import { isAxiosError } from "axios";
import { useSettings } from "../../../providers/settings";
import { useGetLatestReferralCode } from "./use-get-latest-referral-code";
import { setStorageItem } from "../../../services/local-storage";
import { useSKQueryClient } from "../../../providers/query-client";

const queryKey = ["referral-code"];

export const useReferralCode = () => {
  const latestReferralCode = useGetLatestReferralCode();

  const { referralCheck } = useSettings();

  return useQuery({
    queryKey,
    enabled: !latestReferralCode.isPending && !!referralCheck,
    staleTime: Infinity,
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(latestReferralCode.data).toEither(
            new Error("missing referral code")
          )
        ).chain((code) => fn(code))
      ).unsafeCoerce(),
  });
};

export const useValidateReferralCode = () => {
  const queryClient = useSKQueryClient();

  return useMutation({
    mutationFn: async (referralCode: string) =>
      (await fn(referralCode)).unsafeCoerce(),
    onSuccess: (data) => {
      setStorageItem("sk-widget@1//referralCode", data.code);
      queryClient.setQueryData(queryKey, data);
    },
  });
};

const fn = (referralCode: string) =>
  EitherAsync.liftEither(
    Maybe.fromNullable(APIManager.getInstance()).toEither(
      new Error("missing api client")
    )
  ).chain((client) =>
    EitherAsync(() =>
      client.get<{ id: string; code: string }>(`/v1/referrals/${referralCode}`)
    )
      .map((res) => res.data)
      .mapLeft((err) => (isAxiosError(err) ? err : new Error("unknown error")))
  );
