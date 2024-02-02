import { useMutation, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { APIManager } from "@stakekit/api-hooks";
import { useInitQueryParams } from "../../use-init-query-params";
import { queryClient } from "../../../services/query-client";
import { isAxiosError } from "axios";
import { useSettings } from "../../../providers/settings";

const queryKey = ["referral-code"];

export const useReferralCode = () => {
  const initQueryParams = useInitQueryParams();

  const { referralCheck } = useSettings();

  return useQuery({
    queryKey,
    enabled: !initQueryParams.isPending && !!referralCheck,
    staleTime: Infinity,
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(initQueryParams.data?.referralCode).toEither(
            new Error("missing referral code")
          )
        ).chain((code) => fn(code))
      ).unsafeCoerce(),
  });
};

export const useValidateReferralCode = () =>
  useMutation({
    mutationFn: async (referralCode: string) =>
      (await fn(referralCode!)).unsafeCoerce(),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

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
