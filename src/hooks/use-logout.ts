import { useStakeDispatch } from "../state/stake";
import { useSKWallet } from "../providers/sk-wallet";
import { EitherAsync } from "purify-ts";
import { useMutation } from "@tanstack/react-query";

export const useLogout = () => {
  const { disconnect } = useSKWallet();
  const appDispatch = useStakeDispatch();

  return useMutation({
    mutationFn: async () => {
      appDispatch({ type: "state/reset" });

      await EitherAsync(disconnect)
        .chain(() => EitherAsync(() => indexedDB.databases()))
        .ifRight((dbs) =>
          dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name))
        );
    },
  });
};
