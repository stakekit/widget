import type { WalletService } from "../../src/providers/wallet/runtime/service";

export type WalletOperations = Omit<
  WalletService["Service"],
  "bind" | "persistPublicKey"
>;
