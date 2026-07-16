import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { WagmiConfigProvider } from "../../../features/wallet";
import { CurrentLayoutProvider } from "../../../features/widget-shell";
import { SKLocationProvider } from "../../../shared/react/location-history";
import { RootElementProvider } from "../../../shared/react/root-element";
import { i18nInstance } from "../../../translation";
import { WidgetConfigEffects } from "../../config/widget-config-effects";
import { SKRootInputProvider } from "./atom-runtime";
import { MountAnimationEffects } from "./mount-animation";
import { ThirdPartyQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { SolanaProvider } from "./solana";
import { ThemeWrapper } from "./theme-wrapper";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  return (
    <StrictMode>
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <WidgetConfigEffects>
            <ThirdPartyQueryClientProvider>
              <SKLocationProvider>
                <MountAnimationEffects />
                <SolanaProvider>
                  <SKRootInputProvider>
                    <WagmiConfigProvider>
                      <RainbowProvider>
                        <ThemeWrapper>
                          <CurrentLayoutProvider>
                            {children}
                          </CurrentLayoutProvider>
                        </ThemeWrapper>
                      </RainbowProvider>
                    </WagmiConfigProvider>
                  </SKRootInputProvider>
                </SolanaProvider>
              </SKLocationProvider>
            </ThirdPartyQueryClientProvider>
          </WidgetConfigEffects>
        </I18nextProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
