import { Data } from "effect";

type BorrowFeatureConfiguration = {
  readonly borrowEnabled: boolean;
  readonly dashboardVariant?: boolean;
  readonly yieldGrouping: "category" | "flat";
};

export class BorrowFeatureDisabled extends Data.TaggedError(
  "BorrowFeatureDisabled"
)<{
  readonly message: string;
}> {}

export class InvalidBorrowFeatureConfiguration extends Data.TaggedError(
  "InvalidBorrowFeatureConfiguration"
)<{
  readonly message: string;
}> {}

export const validateBorrowFeatureConfiguration = ({
  borrowEnabled,
  dashboardVariant,
  yieldGrouping,
}: BorrowFeatureConfiguration): void => {
  if (!borrowEnabled) return;

  if (!dashboardVariant) {
    throw new InvalidBorrowFeatureConfiguration({
      message: "Borrow requires dashboardVariant to be enabled.",
    });
  }

  if (yieldGrouping !== "category") {
    throw new InvalidBorrowFeatureConfiguration({
      message: 'Borrow requires yieldGrouping to be "category".',
    });
  }
};
