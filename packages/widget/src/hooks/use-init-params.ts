import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { WalletInitParams } from "../domain/schema/wallet-models";
import { useSettings } from "../providers/settings";
import {
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "../providers/wagmi/atoms";

export const useInitParams = <T = WalletInitParams>(opts?: {
  select: (val: WalletInitParams) => T;
}) => {
  const { externalProviders } = useSettings();
  const result = useAtomValue(
    walletInitParamsAtom(
      new WalletInitParamsKey({
        externalProviderInitToken: externalProviders?.initToken ?? null,
      })
    )
  );
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value === undefined ? undefined : (opts?.select(value) ?? value),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  } as const;
};
