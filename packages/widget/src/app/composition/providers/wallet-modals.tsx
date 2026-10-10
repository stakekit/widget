import type { PropsWithChildren } from "react";
import { WalletModalsProvider } from "../../../features/wallet/views";

export const WalletPresentationProvider = ({ children }: PropsWithChildren) => (
  <WalletModalsProvider>{children}</WalletModalsProvider>
);
