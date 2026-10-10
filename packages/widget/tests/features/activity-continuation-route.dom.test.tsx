import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import { act, StrictMode } from "react";
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { describe, expect, it } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import { ActivityActionRoute } from "../../src/features/activity/react/activity-action-route";
import {
  ActivityDefaultIntent,
  ActivityExplicitIntent,
  ActivitySelectionKey,
  activityDetailsViewAtom,
} from "../../src/features/activity/state/details";
import type { ClassicFlowSession } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { walletScopeAtom } from "../../src/features/wallet/index";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom.tsx";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)("0xWallet"),
  network: "ethereum",
});
const selectedYield = yieldApiYieldFixture();
const item: ActivityActionItem = {
  actionData: yieldApiActionFixture({
    status: "WAITING_FOR_NEXT",
    yieldId: selectedYield.id,
  }),
  validatorsData: [],
  walletScope,
  yieldData: selectedYield,
};
const actionId = item.actionData.id;
const reviewPath = `/activity/${encodeURIComponent(actionId)}`;
const otherItem: ActivityActionItem = {
  ...item,
  actionData: yieldApiActionFixture({
    id: "action-other",
    status: "SUCCESS",
    yieldId: selectedYield.id,
  }),
};
const detailsView = (
  intent: ActivityDefaultIntent | ActivityExplicitIntent,
  surface: "execution" | "review",
  details: ActivityActionItem,
  canContinue: boolean
) =>
  [
    activityDetailsViewAtom(
      new ActivitySelectionKey({ intent, scope: walletScope, surface })
    ),
    { canContinue, item: details, providersDetails: [], status: "ready" },
  ] as const;
// Activity only offers a Continuation on the Review surface.
const seededDetails = [
  detailsView(new ActivityExplicitIntent({ actionId }), "review", item, true),
  detailsView(
    new ActivityExplicitIntent({ actionId }),
    "execution",
    item,
    false
  ),
  detailsView(
    new ActivityExplicitIntent({ actionId: otherItem.actionData.id }),
    "review",
    otherItem,
    false
  ),
  detailsView(new ActivityDefaultIntent(), "review", item, true),
] as const;

// The registry drops idle nodes with their seeded values; holding the seeded
// Activity details keeps them in place while the route switches surface.
const SeededDetailsRetainer = () => {
  useAtomValue(seededDetails[0][0]);
  useAtomValue(seededDetails[1][0]);
  useAtomValue(seededDetails[2][0]);
  useAtomValue(seededDetails[3][0]);
  return null;
};

const LocationProbe = () => (
  <output data-testid="location">{useLocation().pathname}</output>
);

const NavigationCapture = ({
  capture,
}: {
  readonly capture: (navigate: NavigateFunction) => void;
}) => {
  capture(useNavigate());
  return null;
};

const renderActivity = async (
  initialPath: string,
  presentation: "Classic" | "Dashboard" = "Classic"
) => {
  const opened: Array<ClassicFlowSession> = [];
  const closed: Array<ClassicFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  const service = ClassicTransactionFlowService.of({
    openSession: (session) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          opened.push(session);
          return {
            acquireExecution: () => Effect.die("Not used"),
            acquireReview: () => Effect.die("Not used"),
            intake: session.intake,
          };
        }),
        () => Effect.sync(() => closed.push(session))
      ),
    start: () => Effect.die("Not used"),
  });
  // Production renders the widget in StrictMode with the default idle TTL.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[
          [walletScopeAtom, walletScope],
          [
            walletRuntime.layer,
            Layer.succeed(ClassicTransactionFlowService, service) as never,
          ],
          ...seededDetails,
        ]}
      >
        <SeededDetailsRetainer />
        <MemoryRouter initialEntries={[initialPath]}>
          <NavigationCapture
            capture={(navigate) => {
              navigation.current = navigate;
            }}
          />
          <LocationProbe />
          <Routes>
            {presentation === "Dashboard" ? (
              <Route
                path="/activity"
                element={<ActivityActionRoute presentation="Dashboard" />}
              >
                <Route index element={<div>Default</div>} />
              </Route>
            ) : (
              <Route path="/activity" element={<div>Activity list</div>} />
            )}
            <Route
              path="/activity/:actionId"
              element={<ActivityActionRoute presentation={presentation} />}
            >
              <Route index element={<div>Review</div>} />
              <Route path="steps" element={<div>Steps</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    </StrictMode>
  );
  const location = () =>
    app.container.querySelector('[data-testid="location"]')?.textContent;
  const navigate = (to: string) =>
    act(async () => {
      await navigation.current?.(to);
    });
  return { app, closed, location, navigate, opened };
};

describe("Activity Yield Action Continuation route", () => {
  it("owns one continuation Session from Review through Steps and ends it on leave", async () => {
    const activity = await renderActivity(reviewPath);
    await expect.poll(() => activity.opened.length).toBe(1);
    const [session] = activity.opened;
    expect(session?.intake).toMatchObject({
      _tag: "YieldActionContinuation",
      action: { id: actionId },
      walletScope,
    });
    expect(session?.destination.reviewPath).toBe(reviewPath);
    expect(activity.app.container.textContent).toContain("Review");

    await activity.navigate(`${reviewPath}/steps`);
    await expect
      .poll(() => activity.app.container.textContent)
      .toContain("Steps");
    expect(activity.location()).toBe(`${reviewPath}/steps`);
    expect(activity.opened).toEqual([session]);
    expect(activity.closed).toEqual([]);

    await activity.navigate("/activity");
    await expect.poll(() => activity.closed).toEqual([session]);
    expect(activity.opened).toEqual([session]);
    expect(activity.location()).toBe("/activity");
  });

  it("redirects an execution URL without a mounted continuation to Review", async () => {
    const activity = await renderActivity(`${reviewPath}/steps`);

    await expect.poll(() => activity.location()).toBe(reviewPath);
    expect(activity.app.container.textContent).not.toContain("Steps");
    await expect.poll(() => activity.opened.length).toBe(1);
    expect(activity.opened[0]?.intake).toMatchObject({
      action: { id: actionId },
    });
  });

  it("drops the continuation when another action is selected", async () => {
    const activity = await renderActivity(reviewPath, "Dashboard");
    await expect.poll(() => activity.opened.length).toBe(1);
    const [first] = activity.opened;

    await activity.navigate(
      `/activity/${encodeURIComponent(otherItem.actionData.id)}`
    );
    await expect.poll(() => activity.closed).toEqual([first]);

    // Returning straight to Steps must not resume the dropped continuation.
    await activity.navigate(`${reviewPath}/steps`);
    await expect.poll(() => activity.location()).toBe(reviewPath);
    expect(activity.app.container.textContent).not.toContain("Steps");
  });

  it("moves a continuable default selection to its own action route", async () => {
    const activity = await renderActivity("/activity", "Dashboard");

    await expect.poll(() => activity.location()).toBe(reviewPath);
    await expect.poll(() => activity.opened.length).toBe(1);
    expect(activity.app.container.textContent).toContain("Review");

    await activity.navigate(`${reviewPath}/steps`);
    await expect
      .poll(() => activity.app.container.textContent)
      .toContain("Steps");
    expect(activity.opened).toHaveLength(1);
    expect(activity.closed).toEqual([]);
  });
});
