import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { SummaryProvider } from "../hooks/use-summary";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { PoweredByHeightProvider } from "../pages/components/powered-by";
import { EarnPageStateProvider } from "../pages/details/earn-page/state/earn-page-state-context";
import { ActivityProvider } from "./activity-provider";
import { SKApiClientProvider } from "./api/api-client-provider";
import { EnterStakeStoreProvider } from "./enter-stake-store";
import { WidgetErrorTrackingContextSync } from "./error-tracking";
import { ExitStakeStoreProvider } from "./exit-stake-store";
import { ListStateContextProvider } from "./list-state";
import { SKLocationProvider } from "./location";
import { MountAnimationProvider } from "./mount-animation";
import { PendingActionStoreProvider } from "./pending-action-store";
import { SKQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { RootElementProvider } from "./root-element";
import { SKWalletProvider } from "./sk-wallet";
import { SolanaProvider } from "./solana";
import { ActionHistoryContextProvider } from "./stake-history";
import { TrackingContextProviderWithProps } from "./tracking";
import { WagmiConfigProvider } from "./wagmi/provider";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  return (
    <StrictMode>
      <RootElementProvider>
        <SKApiClientProvider>
          <SKQueryClientProvider>
            <SKLocationProvider>
              <MountAnimationProvider>
                <SolanaProvider>
                  <WagmiConfigProvider>
                    <TrackingContextProviderWithProps>
                      <SKWalletProvider>
                        <WidgetErrorTrackingContextSync />
                        <RainbowProvider>
                          <ActionHistoryContextProvider>
                            <EarnPageStateProvider>
                              <ListStateContextProvider>
                                <CurrentLayoutProvider>
                                  <HeaderHeightProvider>
                                    <PoweredByHeightProvider>
                                      <DisableTransitionDurationProvider>
                                        <EnterStakeStoreProvider>
                                          <ExitStakeStoreProvider>
                                            <PendingActionStoreProvider>
                                              <ActivityProvider>
                                                <SummaryProvider>
                                                  {children}
                                                </SummaryProvider>
                                              </ActivityProvider>
                                            </PendingActionStoreProvider>
                                          </ExitStakeStoreProvider>
                                        </EnterStakeStoreProvider>
                                      </DisableTransitionDurationProvider>
                                    </PoweredByHeightProvider>
                                  </HeaderHeightProvider>
                                </CurrentLayoutProvider>
                              </ListStateContextProvider>
                            </EarnPageStateProvider>
                          </ActionHistoryContextProvider>
                        </RainbowProvider>
                      </SKWalletProvider>
                    </TrackingContextProviderWithProps>
                  </WagmiConfigProvider>
                </SolanaProvider>
              </MountAnimationProvider>
            </SKLocationProvider>
          </SKQueryClientProvider>
        </SKApiClientProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
