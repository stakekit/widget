import plugin from "../../../scripts/oxlint/layout-plugin";
import { ruleRunner, tester, widget } from "./rule-tester";

const run = ruleRunner(plugin.rules);

run("no-host-variant-comparison", {
  filename: `${widget}src/features/earn/ui/page.tsx`,
  message:
    "Read a Host Profile capability from Widget Configuration instead of comparing the host variant with a string literal. Only the configuration Module may branch on variant names.",
  valid: [
    "const compact = hostProfile.earnPresentation.compact",
    'const showsAmount = props.variant === "action"',
    'const positions = variant === "positions"',
    'const hidden = walletCatalogue === "porto"',
    "const dashboard = dashboardVariant === true",
    'switch (status) {\n  case "zerion":\n    break;\n}',
  ],
  invalid: [
    'const tos = variant === "utila"',
    "const zerion = variant !== 'zerion'",
    'const sort = config.variant === "porto"',
    'const finery = "finery" === variant',
    'const border = appVariant === "finery"',
    'const host = settings.hostVariant == "default"',
    'switch (variant) {\n  case "zerion":\n    break;\n}',
  ],
  outOfScope: [
    "src/services/config/host-profile.ts",
    "src/generated/api/yield.ts",
  ].map((file) => ({
    code: 'const tos = variant === "utila"',
    filename: `${widget}${file}`,
  })),
});

run("no-layout-name-in-logic", {
  filename: `${widget}src/features/earn/model/details.ts`,
  message:
    "Logic is Layout-agnostic. Name what the code models, not the Layout that shows it; Layout names belong to the application composition and Feature `ui/compact` or `ui/dashboard`.",
  valid: [
    'const layout: WidgetLayout = "Dashboard"',
    'const grouped = layout === "Compact"',
    'const label = t("dashboard.earn_details.apy")',
    "const formatted = formatCompactNumber(tvl, locale)",
    'export const formatMeaningfulCompactUsd = () => ""',
    'const categoryGrouping = config.yieldGrouping === "category"',
    "const { condensed } = hostProfile.earnPresentation",
  ],
  invalid: [
    "export const getDashboardPositionDetailsModel = () => null",
    "type DashboardPositionMetricCard = { readonly label: string }",
    "const compactLayoutHeight = 0",
    "const grouping = entry.dashboardVariant",
    "const entry = { dashboardVariant: true }",
    "const { dashboardVariant } = entry",
    "const isCompact = true",
    "export const shouldShowActivityDashboardSplit = () => false",
  ],
  outOfScope: [
    "src/services/config/widget-config-boundary.ts",
    "src/features/earn/ui/details.ts",
    "src/domain/earn/details.tsx",
  ].map((file) => ({
    code: "const isCompact = true",
    filename: `${widget}${file}`,
  })),
});

run("no-layout-path-outside-layout-ui", {
  filename: `${widget}src/features/earn/dashboard-details.ts`,
  message:
    "A path naming a Layout belongs under a `ui/compact` or `ui/dashboard` directory or `src/app/layouts`. Elsewhere, name the file or directory after what it holds, not the Layout.",
  valid: [],
  invalid: ["export const value = 1"],
  outOfScope: [
    "src/features/earn/details.ts",
    "src/features/earn/ui/dashboard/details.tsx",
    "src/features/earn/ui/compact-details.tsx",
    "src/app/layouts/dashboard/tabs.tsx",
    "tests/features/dashboard/details.test.ts",
  ].map((file) => ({
    code: "export const value = 1",
    filename: `${widget}${file}`,
  })),
});

tester.run(
  "no-layout-path-outside-layout-ui directories",
  plugin.rules["no-layout-path-outside-layout-ui"],
  {
    valid: [],
    invalid: [
      "src/features/Compact/state/details.ts",
      "src/shared/dashboardParts/row.tsx",
    ].map((file) => ({
      code: "export const value = 1",
      filename: `${widget}${file}`,
      errors: 1,
    })),
  }
);

run("no-layout-read-in-features", {
  filename: `${widget}src/features/earn/ui/page.tsx`,
  message:
    "Features are Layout-agnostic; the application composes each Layout. Put a Layout-specific screen under `ui/compact` or `ui/dashboard`, or take a prop the Layout composition supplies.",
  valid: [
    'const variant = useWidgetConfig("variant")',
    'const { earnPresentation } = useWidgetConfig("hostProfile")',
    "const shown = useMountAnimation().state.layout",
    "const { state } = useMountAnimation(); const ready = state.layout",
    "const grouping = get(widgetConfigAtom).yieldGrouping",
    "const { locale } = useWidgetPresentation()",
    'const element = <motion.div layout="position" />',
    "const { layout } = props",
  ],
  invalid: [
    'const layout = useWidgetConfig("layout")',
    "const layout = useWidgetConfig('layout')",
    'const dashboard = config.layout === "Dashboard"',
    "const layout = get(widgetConfigAtom).layout",
    "const layout = context(widgetConfigAtom).layout",
    "const layout = registry.get(widgetConfigAtom).layout",
    "const { layout } = get(widgetConfigAtom)",
    "const { layout: current } = context.get(widgetConfigAtom)",
    "const attribute = useWidgetPresentation().layout",
    "const { layout } = useWidgetPresentation()",
  ],
  outOfScope: [
    "src/App.tsx",
    "src/app/layouts/dashboard/tabs.tsx",
    "src/services/config/widget-config.ts",
    "src/features/widget-configuration/state.ts",
  ].map((file) => ({
    code: 'const layout = useWidgetConfig("layout")',
    filename: `${widget}${file}`,
  })),
});

run("no-raw-widget-path", {
  filename: `${widget}src/features/earn/ui/page.tsx`,
  message:
    "Build Widget paths, route patterns, and route matchers from the route registry (`services/navigation/widget-routes.ts`) instead of string literals. Only relative `..` redirects and `*` catch-alls may stay literal.",
  valid: [
    "navigate(widgetRoutes.activity.build())",
    "navigation.push(widgetRoutes.positions.build())",
    "router.navigate(-1)",
    "const match = useWidgetRouteMatch(widgetRoutes.positionDetails)",
    'const element = <Navigate replace to=".." />',
    'const element = <Navigate replace to="../.." />',
    'const element = <Navigate replace relative="path" to=".." />',
    "const element = <WidgetNavigate replace to={widgetRoutes.earn.build()} />",
    'const element = <Route path="*" element={<Fallback />} />',
    "const element = <Route path={widgetRoutes.activity.pattern} element={<Page />} />",
    "const element = <Route index element={<Page />} />",
    'const element = <Input path="/positions" />',
    'const hex = value.startsWith("0x")',
    "const scoped = account.startsWith(`${chainId}:`)",
    'const root = segment === "/"',
    'const endpoint = HttpClientRequest.get("/v1/yields")',
  ],
  invalid: [
    'navigate("/activity")',
    "navigate(`action/${action.id}`)",
    'router.navigate("/positions", { replace: true })',
    'const match = useMatch("/activity/:actionId/steps")',
    'const match = matchPath("positions/:integrationId/:balanceId", pathname)',
    'const element = <Navigate to="/" replace />',
    "const element = <Navigate replace to={`/positions/${id}`} />",
    'const element = <WidgetLink to="/positions">Positions</WidgetLink>',
    'const element = <SKLink relative="path" to={`../positions/borrow/${id}`}>Market</SKLink>',
    'const element = <Route path="positions" element={<Page />} />',
    'const element = <Route path=":integrationId/:balanceId">{children}</Route>',
    'const activity = location.pathname.startsWith("/activity")',
    'const borrow = Match.when(startsWith("/borrow"), () => "borrow")',
    'const earn = location.pathname === "/"',
    'const other = "/positions" !== pathname',
  ],
  outOfScope: [
    "src/services/navigation/widget-routes.ts",
    "src/generated/api/routes.ts",
  ].map((file) => ({
    code: 'navigate("/activity")',
    filename: `${widget}${file}`,
  })),
});
