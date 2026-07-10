import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { EitherAsync } from "purify-ts";
import { logoutAtom } from "../atoms/wallet-workflows";
import { useSKWallet } from "../providers/sk-wallet";

export const useLogout = () => {
  const { disconnect } = useSKWallet();
  const result = useAtomValue(logoutAtom);
  const execute = useAtomSet(logoutAtom, { mode: "promise" });
  const mutateAsync = () =>
    execute({
      run: async () => {
        await EitherAsync(disconnect)
          .chain(() => EitherAsync(() => indexedDB.databases()))
          .ifRight((dbs) =>
            dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name))
          );
      },
    });

  return {
    error: AsyncResult.isFailure(result) ? result.cause : undefined,
    isError: AsyncResult.isFailure(result),
    isPending: result.waiting,
    mutate: () => {
      void mutateAsync().catch(() => undefined);
    },
    mutateAsync,
  } as const;
};
