import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { ThemeWrapper } from "./theme-wrapper";
import { WagmiConfigProvider } from "./wagmi/provider";
import { SKWalletProvider } from "./sk-wallet";
import { RainbowProvider } from "./rainbow";
import { TrackingContextProviderWithProps } from "./tracking";
import { ActionHistoryContextProvider } from "./stake-history";
import { ListStateContextProvider } from "./list-state";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { SKLocationProvider } from "./location";
import {
  FooterButtonProvider,
  FooterHeightProvider,
} from "../pages/components/footer-outlet/context";
import { MountAnimationProvider } from "./mount-animation";
import { SKQueryClientProvider } from "./query-client";
import { SKApiClientProvider } from "./api/api-client-provider";
import { PoweredByHeightProvider } from "../pages/components/powered-by";
import { RootElementProvider } from "./root-element";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";
import { StakeEnterAndTxsConstructProvider } from "@sk-widget/hooks/api/use-stake-enter-and-txs-construct";
import { PendingActionAndTxsConstructContextProvider } from "@sk-widget/hooks/api/use-pending-action-and-txs-construct";
import { StakeExitAndTxsConstructContextProvider } from "@sk-widget/hooks/api/use-stake-exit-and-txs-construct";
import { EarnPageStateProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";

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
                <WagmiConfigProvider>
                  <TrackingContextProviderWithProps>
                    <SKWalletProvider>
                      <RainbowProvider>
                        <EarnPageStateProvider>
                          <ActionHistoryContextProvider>
                            <StakeEnterAndTxsConstructProvider>
                              <PendingActionAndTxsConstructContextProvider>
                                <StakeExitAndTxsConstructContextProvider>
                                  <ThemeWrapper>
                                    <ListStateContextProvider>
                                      <CurrentLayoutProvider>
                                        <HeaderHeightProvider>
                                          <FooterHeightProvider>
                                            <FooterButtonProvider>
                                              <PoweredByHeightProvider>
                                                <DisableTransitionDurationProvider>
                                                  {children}
                                                </DisableTransitionDurationProvider>
                                              </PoweredByHeightProvider>
                                            </FooterButtonProvider>
                                          </FooterHeightProvider>
                                        </HeaderHeightProvider>
                                      </CurrentLayoutProvider>
                                    </ListStateContextProvider>
                                  </ThemeWrapper>
                                </StakeExitAndTxsConstructContextProvider>
                              </PendingActionAndTxsConstructContextProvider>
                            </StakeEnterAndTxsConstructProvider>
                          </ActionHistoryContextProvider>
                        </EarnPageStateProvider>
                      </RainbowProvider>
                    </SKWalletProvider>
                  </TrackingContextProviderWithProps>
                </WagmiConfigProvider>
              </MountAnimationProvider>
            </SKLocationProvider>
          </SKQueryClientProvider>
        </SKApiClientProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
