/**
 * Wallet list rules, by wallet ID: the `id` passed to `mapWalletFn`, or the
 * EIP-6963 reverse-DNS ID for injected wallets.
 */
export type WalletPolicy = {
  /** Shows only these wallet IDs. An empty list hides every wallet. */
  readonly allow?: ReadonlyArray<string>;
  /** Hides these wallet IDs, even when allowed. */
  readonly deny?: ReadonlyArray<string>;
  /** Lists these wallet IDs first within their group. */
  readonly order?: ReadonlyArray<string>;
  /** Moves wallets into named groups: wallet ID to group name. */
  readonly groups?: Readonly<Record<string, string>>;
  /** Lists these group names first. */
  readonly groupOrder?: ReadonlyArray<string>;
};

type WalletIdentity = Readonly<{ id: string }>;

export type WalletPolicyGroup<Wallet extends WalletIdentity> = Readonly<{
  groupName: string;
  wallets: ReadonlyArray<Wallet>;
}>;

const firstIndexById = (ids: ReadonlyArray<string> | undefined) => {
  const firstIndexes = new Map<string, number>();

  for (const [index, id] of (ids ?? []).entries()) {
    if (!firstIndexes.has(id)) firstIndexes.set(id, index);
  }

  return firstIndexes;
};

const byConfiguredOrder =
  <Value>(
    order: ReadonlyMap<string, number>,
    identity: (value: Value) => string
  ) =>
  (left: Value, right: Value): number => {
    const leftIndex = order.get(identity(left));
    const rightIndex = order.get(identity(right));

    if (leftIndex === undefined && rightIndex === undefined) return 0;
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;

    return leftIndex - rightIndex;
  };

export const applyWalletPolicy = <Wallet extends WalletIdentity>(
  available: ReadonlyArray<WalletPolicyGroup<Wallet>>,
  policy: WalletPolicy
): ReadonlyArray<WalletPolicyGroup<Wallet>> => {
  const allow = policy.allow ? new Set(policy.allow) : undefined;
  const deny = new Set(policy.deny);
  const groupNames = [
    ...available.map(({ groupName }) => groupName),
    ...Object.values(policy.groups ?? {}),
  ].filter((groupName, index, names) => names.indexOf(groupName) === index);
  const grouped = new Map<string, Array<Wallet>>(
    groupNames.map((groupName) => [groupName, []])
  );

  for (const group of available) {
    for (const wallet of group.wallets) {
      if (allow && !allow.has(wallet.id)) continue;
      if (deny.has(wallet.id)) continue;

      const groupName = policy.groups?.[wallet.id] ?? group.groupName;
      grouped.get(groupName)?.push(wallet);
    }
  }

  const walletOrder = firstIndexById(policy.order);
  const groupOrder = firstIndexById(policy.groupOrder);

  return [...grouped]
    .map(([groupName, wallets]) => ({
      groupName,
      wallets: wallets.toSorted(byConfiguredOrder(walletOrder, ({ id }) => id)),
    }))
    .filter(({ wallets }) => wallets.length > 0)
    .toSorted(byConfiguredOrder(groupOrder, ({ groupName }) => groupName));
};
