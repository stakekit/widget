import { useAtomValue } from "@effect/atom-react";

import type { Nullable } from "../../../shared/types/utils";
import { RegionCodeKey, regionCodeNameAtom } from "../state/region-code-name";

export const useRegionCodeName = (regionCode: Nullable<string>) =>
  useAtomValue(
    regionCodeNameAtom(new RegionCodeKey({ regionCode: regionCode ?? null }))
  );
