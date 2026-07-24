import type { WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import { WalletIntegrationError } from "../../domain/errors";

const queryFn = async (): Promise<{
  groupName: string;
  wallets: WalletList[number]["wallets"];
} | null> => {
  return import("./safe-connector").then((module) => module.safeConnector());
};

export const getConfig = () =>
  Effect.tryPromise({
    try: queryFn,
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get safe config",
        operation: "safe-config",
      }),
  });
