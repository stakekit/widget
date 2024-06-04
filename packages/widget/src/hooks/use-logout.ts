import { useMutation } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useSKWallet } from "../providers/sk-wallet";

export const useLogout = () => {
  const { disconnect } = useSKWallet();

  return useMutation({
    mutationFn: async () => {
      await EitherAsync(disconnect)
        .chain(() => EitherAsync(() => indexedDB.databases()))
        .ifRight((dbs) =>
          dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name))
        );

      return null;
    },
  });
};
