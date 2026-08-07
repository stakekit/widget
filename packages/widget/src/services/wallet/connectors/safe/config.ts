import { Effect } from "effect";
import { WalletIntegrationError } from "../../domain/errors";

export const getConfig = () =>
  Effect.tryPromise({
    try: () =>
      import("./safe-connector").then((module) => module.safeConnector()),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get safe config",
        operation: "safe-config",
      }),
  });
