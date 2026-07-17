import type { Wallet as SolanaWallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import { Equal } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { SupportedSKChainIds } from "../../domain/types/chains";
import type { SKExternalProviders } from "../../public-api/types";
import { selectAtom } from "../../shared/effect/select-atom";
import { widgetConfigAtom } from "../config/settings";

export type DynamicExternalProviderInput = {
  readonly currentAddress: string;
  readonly currentChain: SupportedSKChainIds | null;
  readonly provider: SKExternalProviders["provider"];
  readonly supportedChainIds: ReadonlyArray<SupportedSKChainIds> | null;
  readonly type: "generic";
} | null;

export type SolanaWalletInput = {
  readonly connection: Connection | null;
  readonly wallets: ReadonlyArray<SolanaWallet>;
};

type InputEquality<A> = (first: A, second: A) => boolean;

const makeRootInputAtom = <A>(
  initialValue: A,
  label: string,
  equals: InputEquality<A> = Equal.equals
) => {
  const state = Atom.make(initialValue);
  const equalWritable = Atom.writable<A, A>(
    (get) => get(state),
    (context, next) => {
      if (!equals(context.get(state), next)) context.set(state, next);
    }
  );

  return Object.assign(equalWritable.pipe(Atom.withLabel(label)), {
    initialValueTarget: state,
  });
};

const solanaWalletInputEquals: InputEquality<SolanaWalletInput> = (
  first,
  second
) =>
  first.connection === second.connection &&
  first.wallets.length === second.wallets.length &&
  first.wallets.every((wallet, index) => wallet === second.wallets[index]);

export const defaultSolanaWalletInput: SolanaWalletInput = {
  connection: null,
  wallets: [],
};

export const normalizeDynamicExternalProviderInput = (
  externalProviders: SKExternalProviders | undefined
): DynamicExternalProviderInput =>
  externalProviders
    ? {
        currentAddress: externalProviders.currentAddress,
        currentChain: externalProviders.currentChain ?? null,
        provider: externalProviders.provider,
        supportedChainIds: externalProviders.supportedChainIds
          ? [...new Set(externalProviders.supportedChainIds)].sort(
              (first, second) => first - second
            )
          : null,
        type: externalProviders.type,
      }
    : null;

export const dynamicExternalProviderInputAtom = selectAtom(
  widgetConfigAtom,
  (settings) =>
    normalizeDynamicExternalProviderInput(settings.externalProviders)
).pipe(Atom.withLabel("dynamicExternalProviderInputAtom"));

export const solanaWalletInputAtom = makeRootInputAtom(
  defaultSolanaWalletInput,
  "solanaWalletInputAtom",
  solanaWalletInputEquals
);

export const normalizeSolanaWalletInput = ({
  connection,
  wallets,
}: SolanaWalletInput): SolanaWalletInput => ({
  connection,
  wallets: [...wallets],
});
