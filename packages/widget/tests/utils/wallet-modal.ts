import { Effect, Stream } from "effect";
import { WalletModal } from "../../src/services/wallet/wallet-modal";

const unexpectedModalOperation = (operation: string) =>
  Effect.die(`stubWalletModal: unexpected call to ${operation}`);

const unexpectedOpenState = (modal: string) => ({
  changes: Stream.fromEffect(unexpectedModalOperation(`${modal}.changes`)),
  current: unexpectedModalOperation(`${modal}.current`),
  revision: unexpectedModalOperation(`${modal}.revision`),
  set: (_open: boolean) => unexpectedModalOperation(`${modal}.set`),
});

type WalletModalStub = Parameters<typeof WalletModal.of>[0];

export const stubWalletModal = (
  overrides: Partial<Pick<WalletModalStub, "closeChain" | "openConnect">> = {}
) =>
  WalletModal.of({
    chainOpen: unexpectedOpenState("chainOpen"),
    closeChain: unexpectedModalOperation("closeChain"),
    connectOpen: unexpectedOpenState("connectOpen"),
    openConnect: unexpectedModalOperation("openConnect"),
    presentationOpen: unexpectedOpenState("presentationOpen"),
    ...overrides,
  });
