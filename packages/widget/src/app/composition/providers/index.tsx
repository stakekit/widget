import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { WagmiConfigProvider } from "../../../features/wallet/react/provider";
import { CurrentLayoutProvider } from "../../../features/widget-shell/current-layout";
import { selectAtom } from "../../../shared/effect/select-atom";
import { SKLocationProvider } from "../../../shared/react/location-history";
import { RootElementProvider } from "../../../shared/react/root-element";
import { i18nInstance } from "../../../translation";
import utilaTranslations from "../../../translation/English/utila-variant.json";
import { widgetConfigAtom } from "../../config/settings";
import { MountAnimationEffects } from "./mount-animation";
import { ThirdPartyQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { ThemeWrapper } from "./theme-wrapper";

const widgetTranslationConfigAtom = selectAtom(
  widgetConfigAtom,
  ({ customTranslations, language, variant }) => ({
    customTranslations,
    language,
    variant,
  })
);

const widgetTranslationEffectsAtom = Atom.make((get) => {
  const { customTranslations, language, variant } = get(
    widgetTranslationConfigAtom
  );

  if (language) {
    void i18nInstance.changeLanguage(language);
  }

  if (variant === "utila") {
    i18nInstance.addResourceBundle(
      "en",
      "translation",
      utilaTranslations,
      true,
      true
    );
  }

  if (customTranslations) {
    Object.entries(customTranslations).forEach(([language, value]) => {
      i18nInstance.addResourceBundle(
        language,
        "translation",
        value.translation,
        true,
        true
      );
    });
  }
}).pipe(Atom.withLabel("widgetTranslationEffectsAtom"));

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
