import { Match } from "effect";
import type { ComponentType } from "react";
import { Route } from "react-router";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  ClassicFlowRoute,
} from "../react/classic-flow-route";
import { PendingCompletePage } from "./complete/pages/pending-complete.page.tsx";
import { StakeCompletePage } from "./complete/pages/stake-complete.page.tsx";
import { UnstakeCompletePage } from "./complete/pages/unstake-complete.page.tsx";
import { PendingReviewPage } from "./review/pages/pending-review.page.tsx";
import { StakeReviewPage } from "./review/pages/stake-review.page.tsx";
import { UnstakeReviewPage } from "./review/pages/unstake-review.page.tsx";
import { PendingStepsPage } from "./steps/pages/pending-steps.page.tsx";
import { StakeStepsPage } from "./steps/pages/stake-steps.page.tsx";
import { UnstakeStepsPage } from "./steps/pages/unstake-steps.page.tsx";

type ClassicFlowRouteMount = { readonly journey: "Enter" | "Exit" | "Manage" };

type StandardClassicFlowJourney = "Enter" | "Exit" | "Manage";

type StandardClassicFlowPages = Readonly<{
  CompletePage: ComponentType;
  ReviewPage: ComponentType;
  StepsPage: ComponentType;
}>;

const createStandardClassicFlowRoutes = (
  journey: StandardClassicFlowJourney,
  { CompletePage, ReviewPage, StepsPage }: StandardClassicFlowPages
) => (
  <Route element={<ClassicFlowRoute expected={journey} />}>
    <Route
      path="review"
      element={
        <ClassicFlowReviewScope>
          <ReviewPage />
        </ClassicFlowReviewScope>
      }
    />
    <Route element={<ClassicFlowExecutionScope />}>
      <Route path="steps" element={<StepsPage />} />
      <Route path="complete" element={<CompletePage />} />
    </Route>
  </Route>
);

export const createClassicFlowRoutes = (mount: ClassicFlowRouteMount) =>
  Match.value(mount).pipe(
    Match.when({ journey: "Enter" }, () =>
      createStandardClassicFlowRoutes("Enter", {
        CompletePage: StakeCompletePage,
        ReviewPage: StakeReviewPage,
        StepsPage: StakeStepsPage,
      })
    ),
    Match.when({ journey: "Exit" }, () =>
      createStandardClassicFlowRoutes("Exit", {
        CompletePage: UnstakeCompletePage,
        ReviewPage: UnstakeReviewPage,
        StepsPage: UnstakeStepsPage,
      })
    ),
    Match.when({ journey: "Manage" }, () =>
      createStandardClassicFlowRoutes("Manage", {
        CompletePage: PendingCompletePage,
        ReviewPage: PendingReviewPage,
        StepsPage: PendingStepsPage,
      })
    ),
    Match.exhaustive
  );
