import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
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
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { YieldActivityItem } from "../../../src/features/activity/model/activity-action";
import {
  ActivityActionRoute,
  useActivityActionRoute,
} from "../../../src/features/activity/react/activity-action-route";
import {
  ActivityDefaultIntent,
  ActivityExplicitIntent,
  ActivitySelectionKey,
  activityDetailsViewAtom,
} from "../../../src/features/activity/state/details";
import type { ClassicFlowSession } from "../../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { useClassicFlowSession } from "../../../src/features/classic-transaction-flow/react/classic-flow-route";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom.tsx";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)("0xWallet"),
  network: "ethereum",
});
const selectedYield = yieldApiYieldFixture();
const item: YieldActivityItem = {
  _tag: "yield",
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
const otherItem: YieldActivityItem = {
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
  details: YieldActivityItem,
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
// wallet scope and Activity details keeps them in place while the route
// switches surface or leaves Activity.
const SeededValuesRetainer = () => {
  useAtomValue(walletScopeAtom);
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

type SessionPageProps = Readonly<{
  readonly name: string;
  readonly sessions: Array<ClassicFlowSession>;
}>;

/** A flow page that shows which Session it renders, numbered by first sight. */
const SessionPage = ({ name, sessions }: SessionPageProps) => {
  const session = useClassicFlowSession();
  if (!sessions.includes(session)) sessions.push(session);
  return (
    <output data-testid="page">
      {name}:{sessions.indexOf(session) + 1}
    </output>
  );
};

/** Review renders inside the continuation Session only when one is mounted. */
const ReviewPage = ({ sessions }: Pick<SessionPageProps, "sessions">) =>
  useActivityActionRoute().continuationReady ? (
    <SessionPage name="Review" sessions={sessions} />
  ) : (
    <output data-testid="page">Review:none</output>
  );

const renderActivity = async (
  initialPath: string,
  presentation: "Classic" | "Dashboard" = "Classic"
) => {
  const sessions: Array<ClassicFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  // Production renders the widget in StrictMode with the default idle TTL.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[[walletScopeAtom, walletScope], ...seededDetails]}
      >
        <SeededValuesRetainer />
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
                element={
                  <ActivityActionRoute
                    presentation="Dashboard"
                    source="yield"
                  />
                }
              >
                <Route index element={<div>Default</div>} />
              </Route>
            ) : (
              <Route path="/activity" element={<div>Activity list</div>} />
            )}
            <Route
              path="/activity/:actionId"
              element={
                <ActivityActionRoute
                  presentation={presentation}
                  source="yield"
                />
              }
            >
              <Route index element={<ReviewPage sessions={sessions} />} />
              <Route
                path="steps"
                element={<SessionPage name="Steps" sessions={sessions} />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    </StrictMode>
  );
  const location = () =>
    app.container.querySelector('[data-testid="location"]')?.textContent;
  const page = () =>
    app.container.querySelector('[data-testid="page"]')?.textContent;
  const navigate = (to: string) =>
    act(async () => {
      await navigation.current?.(to);
    });
  return { app, location, navigate, page, sessions };
};

describe("Activity Yield Action Continuation route", () => {
  it("keeps one continuation Session from Review through Steps and drops it on leave", async () => {
    const activity = await renderActivity(reviewPath);
    await expect.poll(activity.page).toBe("Review:1");
    const [session] = activity.sessions;
    expect(session?.intake).toMatchObject({
      _tag: "YieldActionContinuation",
      action: { id: actionId },
      walletScope,
    });
    expect(session?.destination.reviewPath).toBe(reviewPath);

    await activity.navigate(`${reviewPath}/steps`);
    await expect.poll(activity.page).toBe("Steps:1");
    expect(activity.location()).toBe(`${reviewPath}/steps`);
    expect(activity.sessions).toEqual([session]);

    await activity.navigate("/activity");
    await expect
      .poll(() => activity.app.container.textContent)
      .toContain("Activity list");
    expect(activity.page()).toBeUndefined();

    // Returning straight to Steps must not resume the dropped Session.
    await activity.navigate(`${reviewPath}/steps`);
    await expect.poll(activity.location).toBe(reviewPath);
    await expect.poll(activity.page).toBe("Review:2");
  });

  it("redirects an execution URL without a mounted continuation to Review", async () => {
    const activity = await renderActivity(`${reviewPath}/steps`);

    await expect.poll(activity.location).toBe(reviewPath);
    await expect.poll(activity.page).toBe("Review:1");
    expect(activity.sessions[0]?.intake).toMatchObject({
      action: { id: actionId },
    });
  });

  it("drops the continuation when another action is selected", async () => {
    const activity = await renderActivity(reviewPath, "Dashboard");
    await expect.poll(activity.page).toBe("Review:1");

    await activity.navigate(
      `/activity/${encodeURIComponent(otherItem.actionData.id)}`
    );
    await expect.poll(activity.page).toBe("Review:none");

    // Returning straight to Steps must not resume the dropped continuation.
    await activity.navigate(`${reviewPath}/steps`);
    await expect.poll(activity.location).toBe(reviewPath);
    await expect.poll(activity.page).toBe("Review:2");
    expect(activity.sessions).toHaveLength(2);
  });

  it("moves a continuable default selection to its own action route", async () => {
    const activity = await renderActivity("/activity", "Dashboard");

    await expect.poll(activity.location).toBe(reviewPath);
    await expect.poll(activity.page).toBe("Review:1");

    await activity.navigate(`${reviewPath}/steps`);
    await expect.poll(activity.page).toBe("Steps:1");
    expect(activity.sessions).toHaveLength(1);
  });
});
