import type { WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";

const queryFn = async (): Promise<{
  groupName: string;
  wallets: WalletList[number]["wallets"];
} | null> => {
  return import("./safe-connector").then((module) => module.safeConnector());
};

export const getConfig = () =>
  Effect.tryPromise({
    try: queryFn,
    catch: (error) => new Error("Could not get safe config", { cause: error }),
  });
