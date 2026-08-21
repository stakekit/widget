import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { WidgetTranslationProvider } from "../../../features/preferences/composition";
import { WagmiConfigProvider } from "../../../features/wallet/composition";
import { CurrentLayoutProvider } from "../../../features/widget-shell/composition";
import { RootElementProvider } from "../../../shared/react/root-element";
import { MountAnimationEffects } from "./mount-animation";
import { ThirdPartyQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { ThemeWrapper } from "./theme-wrapper";
import { WidgetPresentationAdapter } from "./widget-presentation";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => (
  <StrictMode>
    <WidgetTranslationProvider>
      <WidgetPresentationAdapter>
        <RootElementProvider>
          <ThirdPartyQueryClientProvider>
            <MountAnimationEffects />
            <WagmiConfigProvider>
              <RainbowProvider>
                <ThemeWrapper>
                  <CurrentLayoutProvider>{children}</CurrentLayoutProvider>
                </ThemeWrapper>
              </RainbowProvider>
            </WagmiConfigProvider>
          </ThirdPartyQueryClientProvider>
        </RootElementProvider>
      </WidgetPresentationAdapter>
    </WidgetTranslationProvider>
  </StrictMode>
);
