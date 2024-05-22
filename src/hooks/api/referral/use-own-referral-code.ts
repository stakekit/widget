import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { EitherAsync, Left, Maybe } from "purify-ts";
import { isAxios4xxError } from "../../../common/utils";
import { useApiClient } from "../../../providers/api/api-client-provider";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import type { Nullable } from "../../../types";

const url = ({ address, network }: { network: string; address: string }) =>
  `/v1/networks/${network}/addresses/${address}/referrals`;

const getQueryKey = ({
  address,
  network,
}: {
  network: Nullable<string>;
  address: Nullable<string>;
}) => ["own-referral-code", network, address];

type ResponseData = { id: string; code: string };

export const useOwnReferralCode = () => {
  const { address, network } = useSKWallet();

  const apiClient = useApiClient();

  const { referralCheck } = useSettings();

  return useQuery({
    enabled: !!(address && network && !!referralCheck),
    queryKey: getQueryKey({ address, network }),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(
            address && network ? { address, network } : null
          ).toEither(new Error("missing args"))
        )
          .chain((val) =>
            EitherAsync(() => apiClient.get<ResponseData>(url(val)))
              .chainLeft((err) => {
                if (isAxios4xxError(err)) {
                  return EitherAsync(() =>
                    apiClient.post<ResponseData>(url(val))
                  );
                }

                return EitherAsync.liftEither(Left(err));
              })
              .mapLeft((err) =>
                isAxiosError(err) ? err : new Error("unknown error")
              )
          )
          .map((res) => res.data)
      ).unsafeCoerce(),
  });
};
