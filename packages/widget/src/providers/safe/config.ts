import type { WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Left, Right } from "purify-ts";
import { config } from "../../config";

const queryKey = [config.appPrefix, "safe-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async (): Promise<{
  groupName: string;
  wallets: WalletList[number]["wallets"];
} | null> => {
  return EitherAsync(() => import("./safe-connector"))
    .mapLeft(() => new Error("Could not import safe-connector"))
    .map((v) => v.safeConnector())
    .chainLeft((e) => EitherAsync.liftEither(e ? Left(e) : Right(null)))
    .caseOf({
      Right: (val) => Promise.resolve(val),
      Left: (l) => Promise.reject(l),
    });
};

export const getConfig = (opts: { queryClient: QueryClient }) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get safe config");
  });
