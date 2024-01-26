import { useMutation, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { APIManager } from "@stakekit/api-hooks";
import { useInitQueryParams } from "../../use-init-query-params";
import { queryClient } from "../../../services/query-client";
import { isAxiosError } from "axios";
import { useSettings } from "../../../providers/settings";

const queryKey = ["referee-code"];

export const useRefereeCode = () => {
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

export const useValidateRefereeCode = () =>
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
      client.get<{ id: string; code: string }>(
        `/v1/referral-code/${referralCode}`
      )
    )
      .map((res) => res.data)
      .mapLeft((err) => (isAxiosError(err) ? err : new Error("unknown error")))
  );
