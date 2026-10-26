import type { WalletBackend, WalletRequest } from "./playground-wallet";

const signatureMethods: ReadonlyArray<WalletRequest["method"]> = [
  "signMessage",
  "signTypedData",
  "signZamaPermit",
];

/**
 * A wallet that signs nothing: after `delayMs` of simulated wallet latency it
 * answers with a numbered fake transaction hash (32 bytes) or signature
 * (65 bytes). Numbering restarts with the page, so runs log the same values.
 */
export const makeScriptedWalletBackend = ({
  delayMs,
}: {
  readonly delayMs: number;
}): WalletBackend => {
  const sent = { count: 0 };

  return {
    execute: async (request) => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, delayMs);
      await promise;

      sent.count += 1;
      const bytes = signatureMethods.includes(request.method) ? 65 : 32;
      return {
        _tag: "Done",
        value: `0x${sent.count.toString(16).padStart(bytes * 2, "0")}`,
      };
    },
  };
};
