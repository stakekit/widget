import { useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import { useSettings } from "../settings";
import type { SettingsProps } from "../settings/types";

export const useTrackingProps = (): {
  tracking: SettingsProps["tracking"];
  variantTracking: SettingsProps["tracking"] | undefined;
} => {
  const { variant, tracking } = useSettings();

  const variantTrackingRes = useQuery({
    queryKey: ["tracking", variant],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      if (variant !== "zerion") return null;

      return (
        await EitherAsync(() => import("./tracking-variants"))
          .ifRight((val) => {
            val.initMixpanel(config[variant].tracking);
            return val.tracking;
          })
          .map((val) => val.tracking)
      ).unsafeCoerce();
    },
  });

  return { tracking, variantTracking: variantTrackingRes.data ?? undefined };
};
