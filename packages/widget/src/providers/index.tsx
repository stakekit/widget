import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { SummaryProvider } from "../hooks/use-summary";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { i18nInstance } from "../translation";
import { SKAtomRuntimeProvider } from "./effect-atom-runtime";
import { ListStateContextProvider } from "./list-state";
import { SKLocationProvider } from "./location";
import { MountAnimationProvider } from "./mount-animation";
import { ThirdPartyQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { RootElementProvider } from "./root-element";
import { SolanaProvider } from "./solana";
import { ThemeWrapper } from "./theme-wrapper";
import { TrackingContextProviderWithProps } from "./tracking";
import { WagmiConfigProvider } from "./wallet/react/provider";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  return (
    <StrictMode>
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <ThirdPartyQueryClientProvider>
            <SKLocationProvider>
              <MountAnimationProvider>
                <SolanaProvider>
                  <SKAtomRuntimeProvider>
                    <WagmiConfigProvider>
                      <TrackingContextProviderWithProps>
                        <RainbowProvider>
                          <ThemeWrapper>
                            <ListStateContextProvider>
                              <CurrentLayoutProvider>
                                <SummaryProvider>{children}</SummaryProvider>
                              </CurrentLayoutProvider>
                            </ListStateContextProvider>
                          </ThemeWrapper>
                        </RainbowProvider>
                      </TrackingContextProviderWithProps>
                    </WagmiConfigProvider>
                  </SKAtomRuntimeProvider>
                </SolanaProvider>
              </MountAnimationProvider>
            </SKLocationProvider>
          </ThirdPartyQueryClientProvider>
        </I18nextProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
