import type { WalletService } from "../../src/services/wallet/wallet-service";

export type WalletOperations = Omit<
  WalletService["Service"],
  "bind" | "persistPublicKey"
>;
