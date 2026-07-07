import { Match } from "effect";

export const projectLtvRatio = ({
  collateralUsd,
  debtUsd,
}: {
  readonly collateralUsd: number;
  readonly debtUsd: number;
}) =>
  Match.value({
    collateralUsd,
    debtUsd,
  }).pipe(
    Match.when(
      ({ collateralUsd }) => collateralUsd > 0,
      () => {
        const projectedLtvRatio = debtUsd / collateralUsd;

        return projectedLtvRatio > 1 ? 100 : projectedLtvRatio;
      }
    ),
    Match.when(
      ({ debtUsd }) => debtUsd > 0,
      () => 100
    ),
    Match.orElse(() => 0)
  );
