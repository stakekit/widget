import { describe, expect, it } from "vitest";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  type ClassicFlowSession,
  isClassicFlowSessionPath,
  makeClassicTransactionFlowDestination,
} from "../../src/features/classic-transaction-flow/state";

const makeSession = (
  tag: ClassicTransactionFlowIntake["_tag"],
  routeBase: Parameters<
    typeof makeClassicTransactionFlowDestination
  >[0]["routeBase"],
  overrides?: Pick<
    Parameters<typeof makeClassicTransactionFlowDestination>[0],
    "completePath" | "stepsPath"
  >
): ClassicFlowSession => ({
  destination: makeClassicTransactionFlowDestination({
    routeBase,
    ...overrides,
  }),
  epoch: 1,
  intake: { _tag: tag } as ClassicTransactionFlowIntake,
});

const enterSession = makeSession("Enter", "");
const exitSession = makeSession("Exit", "/positions/yield/balance/unstake");
const manageSession = makeSession(
  "Manage",
  "/positions/yield/balance/pending-action"
);
const activityResumeSession = makeSession("ActivityResume", "/activity", {
  completePath: "/activity/stake/complete",
  stepsPath: "/activity/stake/steps",
});

describe("Classic Flow Session route lifetime", () => {
  it.each([
    { pathname: "/review", session: enterSession },
    { pathname: "/steps", session: enterSession },
    { pathname: "/complete", session: enterSession },
    {
      pathname: "/positions/yield/balance/unstake/review",
      session: exitSession,
    },
    {
      pathname: "/positions/yield/balance/unstake/steps",
      session: exitSession,
    },
    {
      pathname: "/positions/yield/balance/pending-action/review",
      session: manageSession,
    },
    {
      pathname: "/positions/yield/balance/pending-action/complete",
      session: manageSession,
    },
    { pathname: "/activity/review", session: activityResumeSession },
    { pathname: "/activity/stake/steps", session: activityResumeSession },
    { pathname: "/activity/unstake/complete", session: activityResumeSession },
    {
      pathname: "/activity/stake-review/complete",
      session: activityResumeSession,
    },
  ])("keeps the session mounted at $pathname", ({ pathname, session }) => {
    expect(isClassicFlowSessionPath(session, pathname)).toBe(true);
  });

  it("ends the route lifetime outside the matching journey", () => {
    expect(isClassicFlowSessionPath(enterSession, "/")).toBe(false);
    expect(isClassicFlowSessionPath(exitSession, "/review")).toBe(false);
    expect(isClassicFlowSessionPath(activityResumeSession, "/activity")).toBe(
      false
    );
  });
});
