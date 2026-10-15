import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import {
  confidentialTokenBalanceKey,
  getConfidentialAssetToken,
  getConfidentialChainId,
  sameTokenContract,
} from "../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import type { Token } from "../../../domain/token/token";
import { ConfidentialValues } from "../../../services/zama/confidential-values";
import { ZamaService } from "../../../services/zama/zama-service";
import { earnEntryAtom } from "./earn-selection/state/atoms";
import { earnPageQuoteAtom } from "./page-workflow";

export const isHiddenTokenBalance = (
  yieldDto: EarnYieldWithProvider | null,
  token: Token | null
) => {
  const asset = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
  return Boolean(asset && token && sameTokenContract(asset, token));
};

export const revealEarnTokenBalanceAtom = walletRuntime
  .fn((_input: undefined, context) =>
    Effect.gen(function* () {
      const owner = context(earnEntryAtom).walletScope?.address;
      const yieldDto = context(earnPageQuoteAtom).selectedStake;
      const token = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
      const chainId = yieldDto ? getConfidentialChainId(yieldDto) : null;
      if (!owner || !token || chainId === null) return;

      const zama = yield* ZamaService;
      yield* zama.revealTokenBalance({ chainId, owner, token });
    })
  )
  .pipe(Atom.withLabel("revealEarnTokenBalanceAtom"));

export const revealEarnTokenBalanceStatusAtom = Atom.make((get) => {
  const result = get(revealEarnTokenBalanceAtom);
  return {
    failed: AsyncResult.isFailure(result),
    revealing: AsyncResult.isWaiting(result),
  };
}).pipe(Atom.withLabel("revealEarnTokenBalanceStatusAtom"));

export const hideEarnTokenBalanceAtom = appRuntime
  .fn((_input: undefined, context) => {
    const owner = context(earnEntryAtom).walletScope?.address;
    const yieldDto = context(earnPageQuoteAtom).selectedStake;
    const token = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
    if (!owner || !token) return Effect.void;
    const key = confidentialTokenBalanceKey({ owner, token });
    return ConfidentialValues.use((values) =>
      values.remove((candidate) => candidate === key)
    );
  })
  .pipe(Atom.withLabel("hideEarnTokenBalanceAtom"));
