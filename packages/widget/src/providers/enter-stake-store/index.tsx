import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Maybe } from "purify-ts";
import type {
  ActionDto,
  YieldCreateActionDto,
} from "../../domain/types/action";
import type { AddressesDto } from "../../domain/types/addresses";
import type { TokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";
import type { ValidatorDto } from "../../generated/api/yield";

type EnterStakeInitData = {
  requestDto: YieldCreateActionDto;
  addresses: AddressesDto;
  gasFeeToken: Yield["token"];
  selectedStake: Yield;
  selectedValidators: Map<string, ValidatorDto>;
  selectedToken: TokenDto;
};

type EnterStakeRequest = EnterStakeInitData & {
  actionDto: Maybe<ActionDto>;
};

type EnterStakeState = Maybe<EnterStakeRequest>;

const enterStakeRequestAtom = Atom.make<EnterStakeState>(Maybe.empty()).pipe(
  Atom.keepAlive,
  Atom.withLabel("enterStakeRequestAtom")
);

export const useEnterStakeRequest = () => useAtomValue(enterStakeRequestAtom);

export const useSetEnterStakeRequest = () => useAtomSet(enterStakeRequestAtom);
