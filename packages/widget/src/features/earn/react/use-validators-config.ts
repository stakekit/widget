import { useAtomValue } from "@effect/atom-react";
import type { ValidatorsConfig } from "../../../domain/types/yields";
import { validatorsConfigAtom } from "../state/validators-config";

export const useValidatorsConfig = (): ValidatorsConfig =>
  useAtomValue(validatorsConfigAtom);
