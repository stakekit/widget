import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Maybe } from "purify-ts";
import type {
  ActionDto,
  YieldCreateActionDto,
} from "../../domain/types/action";
import type { AddressesDto } from "../../domain/types/addresses";
import type { TokenDto, YieldTokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";

type ExitStakeInitData = {
  requestDto: YieldCreateActionDto;
  addresses: AddressesDto;
  gasFeeToken: Yield["token"];
  unstakeAmount: BigNumber;
  integrationData: Yield;
  unstakeToken: TokenDto | YieldTokenDto;
};

export type ExitStakeRequest = ExitStakeInitData & {
  actionDto: Maybe<ActionDto>;
};

type ExitStakeState = Maybe<ExitStakeRequest>;

const exitStakeRequestAtom = Atom.make<ExitStakeState>(Maybe.empty()).pipe(
  Atom.keepAlive,
  Atom.withLabel("exitStakeRequestAtom")
);

export const useExitStakeRequest = () => useAtomValue(exitStakeRequestAtom);

export const useSetExitStakeRequest = () => useAtomSet(exitStakeRequestAtom);
