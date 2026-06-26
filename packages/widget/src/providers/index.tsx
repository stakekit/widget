import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { SummaryProvider } from "../hooks/use-summary";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { PoweredByHeightProvider } from "../pages/components/powered-by";
import { i18nInstance } from "../translation";
import { SKApiClientProvider } from "./api/api-client-provider";
import { SKAtomRuntimeProvider } from "./effect-atom-runtime";
import { ListStateContextProvider } from "./list-state";
import { SKLocationProvider } from "./location";
import { MountAnimationProvider } from "./mount-animation";
import { SKQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { RootElementProvider } from "./root-element";
import { SKWalletProvider } from "./sk-wallet";
import { SolanaProvider } from "./solana";
import { ActionHistoryContextProvider } from "./stake-history";
import { ThemeWrapper } from "./theme-wrapper";
import { TrackingContextProviderWithProps } from "./tracking";
import { WagmiConfigProvider } from "./wagmi/provider";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  return (
    <StrictMode>
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <SKApiClientProvider>
            <SKAtomRuntimeProvider>
              <SKQueryClientProvider>
                <SKLocationProvider>
                  <MountAnimationProvider>
                    <SolanaProvider>
                      <WagmiConfigProvider>
                        <TrackingContextProviderWithProps>
                          <SKWalletProvider>
                            <RainbowProvider>
                              <ActionHistoryContextProvider>
                                <ThemeWrapper>
                                  <ListStateContextProvider>
                                    <CurrentLayoutProvider>
                                      <HeaderHeightProvider>
                                        <PoweredByHeightProvider>
                                          <DisableTransitionDurationProvider>
                                            <SummaryProvider>
                                              {children}
                                            </SummaryProvider>
                                          </DisableTransitionDurationProvider>
                                        </PoweredByHeightProvider>
                                      </HeaderHeightProvider>
                                    </CurrentLayoutProvider>
                                  </ListStateContextProvider>
                                </ThemeWrapper>
                              </ActionHistoryContextProvider>
                            </RainbowProvider>
                          </SKWalletProvider>
                        </TrackingContextProviderWithProps>
                      </WagmiConfigProvider>
                    </SolanaProvider>
                  </MountAnimationProvider>
                </SKLocationProvider>
              </SKQueryClientProvider>
            </SKAtomRuntimeProvider>
          </SKApiClientProvider>
        </I18nextProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
