import { Data, Array as EArray, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnValidator } from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { Network } from "../../../domain/schema/network-model";
import { filterValidators } from "../../../domain/types/yields";
import {
  type ValidatorsError,
  ValidatorsKey,
  validatorsPullAtom,
} from "../../../resources/validator-directory/validator-directory";
import {
  type PullPage,
  withPullPageDone,
} from "../../../shared/effect/pagination";
import { validatorsConfigAtom } from "./validators-config";

export class YieldValidatorsKey extends Data.Class<{
  readonly network: Network | null;
  readonly search: string | null;
  readonly yieldId: YieldId | null;
}> {}

const emptyYieldValidatorsPage: PullPage<EarnValidator> = {
  hasNextPage: false,
  items: [],
};
const emptyYieldValidatorsPullAtom = Atom.pull<
  PullPage<EarnValidator>,
  ValidatorsError
>(Stream.succeed(emptyYieldValidatorsPage)).pipe(withPullPageDone);

export const yieldValidatorsPullAtom = Atom.family(
  (
    key: YieldValidatorsKey
  ): Atom.Writable<
    Atom.PullResult<PullPage<EarnValidator>, ValidatorsError>,
    void
  > => {
    if (!key.yieldId) return emptyYieldValidatorsPullAtom;

    const yieldId = key.yieldId;
    const source = validatorsPullAtom.foreground(
      new ValidatorsKey({ search: key.search, status: "active", yieldId })
    );

    return Atom.transform(source, (get) => {
      const validatorsConfig = get(validatorsConfigAtom);

      return get(source).pipe(
        AsyncResult.map(({ done, items }) => ({
          done,
          items: EArray.map(items, (page) => ({
            ...page,
            items: key.network
              ? filterValidators({
                  network: key.network,
                  validators: page.items,
                  validatorsConfig,
                  yieldId,
                })
              : page.items,
          })),
        }))
      );
    });
  }
);
