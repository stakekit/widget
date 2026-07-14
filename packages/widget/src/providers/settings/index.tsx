import { Record as EffectRecord } from "effect";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { config } from "../../config";
import type { PreferredTokenYieldsPerNetwork } from "../../domain/types/stake";
import { normalizeDashboardYieldCategoryOrder } from "../../domain/types/yields";
import utilaTranslations from "../../translation/English/utila-variant.json";
import type { SettingsContextType, SettingsProps, VariantProps } from "./types";

type TokenYieldPreferences = Exclude<
  PreferredTokenYieldsPerNetwork[keyof PreferredTokenYieldsPerNetwork],
  undefined
>;

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsContextProvider = ({
  children,
  ...rest
}: PropsWithChildren<SettingsProps & VariantProps>) => {
  if (!config.env.isTestMode && rest.wagmi?.__customConnectors__) {
    rest.wagmi.__customConnectors__ = undefined;
  }

  /**
   * Convert to lower case to match token string
   */
  const preferredTokenYieldsPerNetwork = useMemo(() => {
    const value = rest.preferredTokenYieldsPerNetwork;

    return value
      ? (EffectRecord.map(
          value as Readonly<Record<string, TokenYieldPreferences>>,
          (tokenYields) =>
            EffectRecord.mapKeys(
              tokenYields as Readonly<
                Record<
                  string,
                  TokenYieldPreferences[keyof TokenYieldPreferences]
                >
              >,
              (tokenString) => tokenString.toLowerCase()
            )
        ) as PreferredTokenYieldsPerNetwork)
      : undefined;
  }, [rest.preferredTokenYieldsPerNetwork]);

  const dashboardYieldCategoryOrder = normalizeDashboardYieldCategoryOrder(
    rest.dashboardYieldCategoryOrder
  );

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
      value={{
        ...rest,
        borrowEnabled: rest.borrowEnabled ?? false,
        dashboardYieldCategoryOrder,
        preferredTokenYieldsPerNetwork,
        yieldGrouping:
          rest.yieldGrouping ?? (rest.dashboardVariant ? "category" : "flat"),
      }}
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
