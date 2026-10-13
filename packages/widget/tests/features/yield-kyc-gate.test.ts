import { Effect, Layer, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { walletConnectionStateAtom } from "../../src/features/wallet/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../src/features/yield-summary/state/yield-insights";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const connectedWallet = {
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum" as const,
  status: "connected" as const,
};
const fixture = yieldApiYieldFixture();
const kycYield = {
  ...fixture,
  mechanics: {
    ...fixture.mechanics,
    requirements: { ...fixture.mechanics.requirements, kycRequired: true },
  },
};
const gateKey = new CurrentYieldKycGateKey({
  enabled: true,
  yieldDto: kycYield,
});

describe("Current Yield KYC gate", () => {
  it("keeps the known KYC status when a status refresh fails", () => {
    let offline = false;
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getKycStatus: () =>
                offline
                  ? Effect.fail(
                      new ApiRequestError({
                        cause: new Error("offline"),
                        operation: "yield-api-kyc-status",
                      })
                    )
                  : Effect.succeed({ kycStatus: "approved" as const }),
            } as never)
          )
        ),
        Atom.initialValue(walletConnectionStateAtom, connectedWallet),
      ],
    });
    const gate = currentYieldKycGateAtom(gateKey);
    const unmount = registry.mount(gate);

    try {
      expect(registry.get(gate).gate).toEqual({ state: "pass" });

      offline = true;
      registry.set(refreshCurrentYieldKycAtom(gateKey), undefined);

      expect(registry.get(gate)).toMatchObject({
        gate: { state: "pass" },
        isBlocking: false,
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("is unknown when the first status read fails", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getKycStatus: () =>
                Effect.fail(
                  new ApiRequestError({
                    cause: new Error("offline"),
                    operation: "yield-api-kyc-status",
                  })
                ),
            } as never)
          )
        ),
        Atom.initialValue(walletConnectionStateAtom, connectedWallet),
      ],
    });
    const gate = currentYieldKycGateAtom(gateKey);
    const unmount = registry.mount(gate);

    try {
      expect(registry.get(gate).gate.state).toBe("unknown");
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
