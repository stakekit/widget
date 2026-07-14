import { useAtomValue } from "@effect/atom-react";
import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import { config } from "../../config";
import { useSettings } from "../settings";
import type { SettingsProps } from "../settings/types";

class VariantTrackingKey extends Data.Class<{
  readonly variant: string;
}> {}

const variantTrackingAtom = Atom.family((key: VariantTrackingKey) =>
  Atom.make(
    key.variant === "zerion"
      ? Effect.promise(async () => {
          const module = await import("./tracking-variants");
          module.initMixpanel(config.zerion.tracking);
          return module.tracking;
        })
      : Effect.succeed(null)
  ).pipe(
    withApiResourcePolicy({
      idleTTL: Duration.infinity,
      staleTime: Duration.infinity,
      revalidateOnMount: false,
    })
  )
);

export const useTrackingProps = (): {
  tracking: SettingsProps["tracking"];
  variantTracking: SettingsProps["tracking"] | undefined;
} => {
  const { variant, tracking } = useSettings();
  const result = useAtomValue(
    variantTrackingAtom(new VariantTrackingKey({ variant }))
  );
  const variantTracking = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    tracking,
    variantTracking: variantTracking ?? undefined,
  };
};
