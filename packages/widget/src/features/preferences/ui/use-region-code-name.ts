import { useAtomValue } from "@effect/atom-react";

import { RegionCodeKey, regionCodeNameAtom } from "../state/region-code-name";

export const useRegionCodeName = (regionCode: string | null | undefined) =>
  useAtomValue(
    regionCodeNameAtom(new RegionCodeKey({ regionCode: regionCode ?? null }))
  );
