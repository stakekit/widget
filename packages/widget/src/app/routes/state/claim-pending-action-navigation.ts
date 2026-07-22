export type PendingActionNavigation = Readonly<{
  readonly epoch: number;
  readonly path: string;
}>;

export const claimPendingActionNavigation = ({
  navigation,
  requestedEpoch,
}: {
  readonly navigation: PendingActionNavigation | null;
  readonly requestedEpoch: number;
}): Readonly<{
  readonly navigation: PendingActionNavigation | null;
  readonly path: string | null;
}> =>
  navigation?.epoch === requestedEpoch
    ? { navigation: null, path: navigation.path }
    : { navigation, path: null };
