import { PendingActionAndTxsConstructContextProvider } from "@sk-widget/hooks/api/use-pending-action-and-txs-construct";
import { StakeEnterAndTxsConstructProvider } from "@sk-widget/hooks/api/use-stake-enter-and-txs-construct";
import { StakeExitAndTxsConstructContextProvider } from "@sk-widget/hooks/api/use-stake-exit-and-txs-construct";
import { EarnPageStateProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { EnterStakeRequestDtoProvider } from "@sk-widget/providers/enter-stake-request-dto";
import { ExitStakeRequestDtoProvider } from "@sk-widget/providers/exit-stake-request-dto";
import { PendingStakeRequestDtoProvider } from "@sk-widget/providers/pending-stake-request-dto";
import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";
import {
  FooterButtonProvider,
  FooterHeightProvider,
} from "../pages/components/footer-outlet/context";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { PoweredByHeightProvider } from "../pages/components/powered-by";
import { SKApiClientProvider } from "./api/api-client-provider";
import { ListStateContextProvider } from "./list-state";
import { SKLocationProvider } from "./location";
import { MountAnimationProvider } from "./mount-animation";
import { SKQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { RootElementProvider } from "./root-element";
import { SKWalletProvider } from "./sk-wallet";
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
                                                  <EnterStakeRequestDtoProvider>
                                                    <ExitStakeRequestDtoProvider>
                                                      <PendingStakeRequestDtoProvider>
                                                        {children}
                                                      </PendingStakeRequestDtoProvider>
                                                    </ExitStakeRequestDtoProvider>
                                                  </EnterStakeRequestDtoProvider>
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
