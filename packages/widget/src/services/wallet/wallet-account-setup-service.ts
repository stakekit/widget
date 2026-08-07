import type { Chain } from "@stakekit/rainbowkit";
import { Context, Effect, Layer } from "effect";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";
import { isLedgerLiveConnector } from "./connectors/ledger/ledger-live-connector-meta";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
} from "./domain/errors";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "./domain/scope";
import { WalletModal } from "./wallet-modal";
import { WalletService } from "./wallet-service";

type AddLedgerAccountInput = Readonly<{
  readonly expected: WalletCommandIdentity;
  readonly targetChain?: Chain;
}>;

type WalletAccountSetupOutcome =
  | Readonly<{ readonly _tag: "Added" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type WalletAccountSetupServiceApi = Readonly<{
  readonly addLedgerAccount: (
    input: AddLedgerAccountInput
  ) => Effect.Effect<
    WalletAccountSetupOutcome,
    WalletIntegrationError | WalletRuntimeInvariantError
  >;
}>;

const makeWalletAccountSetupService = Effect.fn(
  "makeWalletAccountSetupService"
)(function* () {
  const modal = yield* WalletModal;
  const wallet = yield* WalletService;
  const operations = yield* makeScopedSerialOperations();

  const addLedgerAccount = Effect.fn("addLedgerAccount")(function* (
    input: AddLedgerAccountInput
  ) {
    return yield* operations.run(
      Effect.gen(function* () {
        const before = yield* wallet.state;
        const connection = before.connection;
        if (
          !sameWalletCommandIdentity(
            input.expected,
            walletCommandIdentity(connection)
          ) ||
          connection.status !== "connected" ||
          !isLedgerLiveConnector(connection.connector)
        ) {
          return { _tag: "RejectedStale" } as const;
        }

        const connectorUid = connection.connector.uid;
        const outcome = yield* wallet.addLedgerAccount(input.targetChain);
        if (outcome._tag === "RejectedUnavailable") {
          return { _tag: "RejectedStale" } as const;
        }

        const after = yield* wallet.state;
        if (
          after.connection.status !== "connected" ||
          !isLedgerLiveConnector(after.connection.connector) ||
          after.connection.connector.uid !== connectorUid
        ) {
          return { _tag: "RejectedStale" } as const;
        }

        yield* modal.closeChain;
        return { _tag: "Added" } as const;
      })
    );
  });

  return { addLedgerAccount } satisfies WalletAccountSetupServiceApi;
});

export class WalletAccountSetupService extends Context.Service<
  WalletAccountSetupService,
  WalletAccountSetupServiceApi
>()("stakekit/widget/services/wallet/WalletAccountSetupService") {
  static readonly layer = Layer.effect(
    WalletAccountSetupService,
    makeWalletAccountSetupService()
  );
}
