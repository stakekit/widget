import { config } from "@sk-widget/config";
import type { SettingsProps } from "@sk-widget/providers/settings";
import { useSettings } from "@sk-widget/providers/settings";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";

export const useTrackingProps = (): {
  tracking: SettingsProps["tracking"];
  variantTracking: SettingsProps["tracking"] | undefined;
} => {
  const { variant, tracking } = useSettings();

  const variantTrackingRes = useQuery({
    queryKey: ["tracking", variant],
    staleTime: Infinity,
    queryFn: async () => {
      if (variant !== "zerion") return null;

      return (
        await EitherAsync(() => import("./tracking-variants"))
          .ifRight((val) => {
            val.initMixpanel(config.trackingVariants[variant]);
            return val.tracking;
          })
          .map((val) => val.tracking)
      ).unsafeCoerce();
    },
  });

  return { tracking, variantTracking: variantTrackingRes.data ?? undefined };
};
