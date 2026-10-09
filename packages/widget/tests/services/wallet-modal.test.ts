import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { WalletModal } from "../../src/services/wallet/wallet-modal";

describe("WalletModal", () => {
  it.effect("owns connect and chain open state", () =>
    Effect.gen(function* () {
      const modal = yield* WalletModal;

      expect(yield* modal.connectOpen.current).toBe(false);
      expect(yield* modal.chainOpen.current).toBe(false);

      yield* modal.openConnect;
      expect(yield* modal.connectOpen.current).toBe(true);

      yield* modal.chainOpen.set(true);
      expect(yield* modal.chainOpen.current).toBe(true);

      yield* modal.closeChain;
      expect(yield* modal.chainOpen.current).toBe(false);

      yield* modal.connectOpen.set(false);
      expect(yield* modal.connectOpen.current).toBe(false);
    }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "keeps picker intent and revision unchanged during native presentation",
    () =>
      Effect.gen(function* () {
        const modal = yield* WalletModal;
        yield* modal.openConnect;
        const revision = yield* modal.connectOpen.revision;
        yield* modal.presentationOpen.set(true);
        expect(yield* modal.connectOpen.current).toBe(true);
        expect(yield* modal.connectOpen.revision).toBe(revision);
        yield* modal.presentationOpen.set(false);
        expect(yield* modal.connectOpen.current).toBe(true);
        expect(yield* modal.connectOpen.revision).toBe(revision);
      }).pipe(Effect.provide(WalletModal.layer))
  );
});
