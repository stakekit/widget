import { Maybe } from "purify-ts";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { config } from "../../config";
import utilaTranslations from "../../translation/English/utila-variant.json";
import type { SettingsContextType } from "./types";

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsContextProvider = ({
  children,
  ...rest
}: PropsWithChildren<SettingsContextType>) => {
  if (!config.env.isTestMode && rest.wagmi?.__customConnectors__) {
    rest.wagmi.__customConnectors__ = undefined;
  }

  /**
   * Convert to lower case to match token string
   */
  const preferredTokenYieldsPerNetwork = useMemo(() => {
    return Maybe.fromNullable(rest.preferredTokenYieldsPerNetwork)
      .map((value) => Object.entries(value))
      .map((entries) =>
        entries.map(([chain, value]) => [
          chain,
          Object.fromEntries(
            Object.entries(value).map(([tokenString, innerValue]) => [
              tokenString.toLowerCase(),
              innerValue,
            ])
          ),
        ])
      )
      .map((entries) => Object.fromEntries(entries))
      .extract() as typeof rest.preferredTokenYieldsPerNetwork;
  }, [rest.preferredTokenYieldsPerNetwork]);

  const { i18n } = useTranslation();

  useLayoutEffect(() => {
    if (rest.language) {
      i18n.changeLanguage(rest.language);
    }
  }, [rest.language, i18n]);

  useLayoutEffect(() => {
    if (rest.variant === "utila") {
      i18n.addResourceBundle(
        "en",
        "translation",
        utilaTranslations,
        true,
        true
      );
    }

    if (rest.customTranslations) {
      Object.entries(rest.customTranslations).forEach(([lng, val]) => {
        i18n.addResourceBundle(lng, "translation", val.translation, true, true);
      });
    }
  }, [rest.customTranslations, i18n, rest.variant]);

  return (
    <SettingsContext.Provider
      value={{ ...rest, preferredTokenYieldsPerNetwork }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error(
      "useSettings must be used within a SettingsContextProvider"
    );
  }

  return context;
};
