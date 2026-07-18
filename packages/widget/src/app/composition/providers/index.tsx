import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { WagmiConfigProvider } from "../../../features/wallet";
import { CurrentLayoutProvider } from "../../../features/widget-shell";
import { SKLocationProvider } from "../../../shared/react/location-history";
import { RootElementProvider } from "../../../shared/react/root-element";
import {
  i18nInstance,
  widgetTranslationEffectsAtom,
} from "../../../translation";
import { MountAnimationEffects } from "./mount-animation";
import { ThirdPartyQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { ThemeWrapper } from "./theme-wrapper";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  useAtomValue(widgetTranslationEffectsAtom);

  return (
    <StrictMode>
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <ThirdPartyQueryClientProvider>
            <SKLocationProvider>
              <MountAnimationEffects />
              <WagmiConfigProvider>
                <RainbowProvider>
                  <ThemeWrapper>
                    <CurrentLayoutProvider>{children}</CurrentLayoutProvider>
                  </ThemeWrapper>
                </RainbowProvider>
              </WagmiConfigProvider>
            </SKLocationProvider>
          </ThirdPartyQueryClientProvider>
        </I18nextProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
