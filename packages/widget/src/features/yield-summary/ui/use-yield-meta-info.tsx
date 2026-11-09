import { useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { Token } from "../../../domain/token/token";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  emptyYieldMetaInfo,
  getYieldMetaInfo,
  type YieldMetaInfo,
  type YieldMetaLinkedCopy,
  type YieldMetaValidator,
} from "../model/yield-meta-info";
import { LinkedCopy } from "./components/linked-copy";

const renderLinkedCopy = (copy: YieldMetaLinkedCopy | null): ReactNode =>
  copy && <LinkedCopy copy={copy} />;

export const useYieldMetaInfo = ({
  selectedStake,
  validators,
  tokenDto,
}: {
  selectedStake: EarnYieldWithProvider | null;
  validators: ReadonlyArray<YieldMetaValidator>;
  tokenDto: Token | null;
}): Omit<YieldMetaInfo, "campaign" | "positionLocked"> & {
  readonly campaign: ReactNode;
  readonly positionLocked: ReactNode;
} => {
  const { t } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const info =
    selectedStake && tokenDto
      ? getYieldMetaInfo({
          now: presentationTime?.now ?? null,
          t,
          token: tokenDto,
          validators,
          yieldDto: selectedStake,
        })
      : emptyYieldMetaInfo;

  return {
    ...info,
    campaign: renderLinkedCopy(info.campaign),
    positionLocked: renderLinkedCopy(info.positionLocked),
  };
};
