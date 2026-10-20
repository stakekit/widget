import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  confidentialTokenBalanceKey,
  getConfidentialAssetToken,
  getConfidentialChainId,
} from "../../../../domain/earn/confidential";
import { confidentialValuesAtom } from "../../../../resources/confidential-values/index";
import { ConfidentialValues } from "../../../../services/zama/confidential-values";
import { ZamaService } from "../../../../services/zama/zama-service";
import {
  isHiddenTokenBalance,
  resolveYieldEntryTokenBalance,
  type YieldEntryTokenBalanceInput,
} from "../../model/confidential-token-balance";

/**
 * Selected entry token balance, including the reveal and hide commands for a
 * confidential asset whose balance only its owner can decrypt.
 */
export const makeConfidentialTokenBalance = (
  inputAtom: Atom.Atom<YieldEntryTokenBalanceInput>
) => {
  const balanceAtom = Atom.make((get) => {
    const input = get(inputAtom);
    const values = isHiddenTokenBalance(input.yield, input.token)
      ? get(confidentialValuesAtom).pipe(AsyncResult.value, Option.getOrNull)
      : null;
    return resolveYieldEntryTokenBalance({ ...input, values });
  }).pipe(Atom.withLabel("yieldEntryTokenBalanceAtom"));

  const revealAtom = walletRuntime
    .fn((_input: undefined, context) =>
      Effect.gen(function* () {
        const { owner, yield: yieldDto } = context(inputAtom);
        const token = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
        const chainId = yieldDto ? getConfidentialChainId(yieldDto) : null;
        if (!owner || !token || chainId === null) return;

        const zama = yield* ZamaService;
        yield* zama.revealTokenBalance({ chainId, owner, token });
      })
    )
    .pipe(Atom.withLabel("revealYieldEntryTokenBalanceAtom"));

  const revealStatusAtom = Atom.make((get) => {
    const result = get(revealAtom);
    return {
      failed: AsyncResult.isFailure(result),
      revealing: AsyncResult.isWaiting(result),
    };
  }).pipe(Atom.withLabel("revealYieldEntryTokenBalanceStatusAtom"));

  const hideAtom = appRuntime
    .fn((_input: undefined, context) => {
      const { owner, yield: yieldDto } = context(inputAtom);
      const token = yieldDto ? getConfidentialAssetToken(yieldDto) : null;
      if (!owner || !token) return Effect.void;
      const key = confidentialTokenBalanceKey({ owner, token });
      return ConfidentialValues.use((values) =>
        values.remove((candidate) => candidate === key)
      );
    })
    .pipe(Atom.withLabel("hideYieldEntryTokenBalanceAtom"));

  return { balanceAtom, hideAtom, revealAtom, revealStatusAtom } as const;
};
