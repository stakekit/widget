import type { ComponentProps } from "react";
import { StrictMode } from "react";
import { WidgetTranslationProvider } from "../../../features/preferences/composition";
import { WagmiConfigProvider } from "../../../features/wallet/composition";
import { MountAnimationEffects } from "./mount-animation";
import { ThemeWrapper } from "./theme-wrapper";
import { WalletPresentationProvider } from "./wallet-modals";
import { WidgetPresentationAdapter } from "./widget-presentation";

export const Providers = ({
  children,
}: ComponentProps<typeof WagmiConfigProvider>) => (
  <StrictMode>
    <WidgetTranslationProvider>
      <WidgetPresentationAdapter>
        <MountAnimationEffects />
        <WagmiConfigProvider>
          {/* The wallet dialogs render beside the children, so they sit
              inside the theme root and portal into its container too. */}
          <ThemeWrapper>
            <WalletPresentationProvider>{children}</WalletPresentationProvider>
          </ThemeWrapper>
        </WagmiConfigProvider>
      </WidgetPresentationAdapter>
    </WidgetTranslationProvider>
  </StrictMode>
);
