import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe } from "purify-ts";
import { APIManager } from "@stakekit/api-hooks";
import { useSKWallet } from "../../../providers/sk-wallet";
import { isAxiosError } from "axios";
import { isAxios4xxError } from "../../../common/utils";
import { useSettings } from "../../../providers/settings";

const url = ({ address, network }: { network: string; address: string }) =>
  `/v1/networks/${network}/addresses/${address}/referrals`;

type ResponseData = { id: string; code: string };

export const useOwnReferralCode = () => {
  const { address, network } = useSKWallet();

  const { referralCheck } = useSettings();

  return useQuery({
    enabled: !!(address && network && !!referralCheck),
    queryKey: [`own-referral-code-${network}`],
    staleTime: Infinity,
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(APIManager.getInstance())
            .chain((client) =>
              Maybe.fromNullable(
                address && network ? { client, address, network } : null
              )
            )
            .toEither(new Error("missing args"))
        )
          .chain((val) =>
            EitherAsync(() => val.client.get<ResponseData>(url(val)))
              .chainLeft((err) => {
                if (isAxios4xxError(err)) {
                  return EitherAsync(() =>
                    val.client.post<ResponseData>(url(val))
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
