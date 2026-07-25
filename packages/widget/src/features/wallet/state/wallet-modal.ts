import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  WalletModal,
  type WalletModalAdapter,
  type WalletModalOwner,
} from "../../../services/wallet/wallet-modal";

type WalletModalAdapterCommand =
  | Readonly<{
      readonly _tag: "Install";
      readonly adapter: WalletModalAdapter;
      readonly owner: WalletModalOwner;
    }>
  | Readonly<{
      readonly _tag: "Uninstall";
      readonly owner: WalletModalOwner;
    }>;

export const walletModalAdapterAtom = appRuntime.fn(
  (command: WalletModalAdapterCommand) =>
    WalletModal.use((modal) => {
      switch (command._tag) {
        case "Install":
          return modal.install(command.owner, command.adapter);
        case "Uninstall":
          return modal.uninstall(command.owner);
      }
    }),
  { concurrent: false }
);
