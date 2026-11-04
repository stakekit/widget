/**
 * Design System migration allowlist: the files (relative to `packages/widget`)
 * that broke a Design System rule when the rule arrived and have not moved to
 * the Design System yet, with the rules each one breaks.
 *
 * `check-design-system-allowlist.ts` (part of the widget `lint` script) fails
 * on an offender this list does not name and on a listed file that no longer
 * offends, so the list only shrinks. Each migration ticket deletes its
 * entries; the last one deletes this file.
 *
 * dependency-cruiser reads this list directly. The ast-grep rules mirror their
 * entries in their `ignores`; after deleting entries, run
 * `pnpm --filter @stakekit/widget check:design-system-allowlist --write` to
 * update the mirrors.
 */
export const designSystemRuleIds = {
  astGrep: [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "no-color-literal-in-design-system",
    "no-raw-design-value",
  ],
  dependencyCruiser: [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
} as const;

export type DependencyCruiserRuleId =
  (typeof designSystemRuleIds.dependencyCruiser)[number];
type DesignSystemRuleId =
  | (typeof designSystemRuleIds.astGrep)[number]
  | DependencyCruiserRuleId;

export type DesignSystemAllowlist = Readonly<
  Record<string, ReadonlyArray<DesignSystemRuleId>>
>;

/** The rules each file not migrated yet breaks, keyed by its path. */
export const designSystemAllowlist: DesignSystemAllowlist = {
  "src/App.tsx": ["design-system-owns-style-modules"],
  "src/app/composition/providers/theme-wrapper.tsx": [
    "no-html-element-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/app/layouts/compact/compact-routes.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
  ],
  "src/app/layouts/dashboard/dashboard-overview.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/app/layouts/dashboard/dashboard-overview.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/app/layouts/dashboard/dashboard-routes.tsx": [
    "design-system-owns-styling-libraries",
  ],
  "src/app/layouts/dashboard/dashboard-shell.tsx": [
    "no-class-name-or-style-outside-design-system",
  ],
  "src/app/layouts/dashboard/dashboard-tabs/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/app/layouts/dashboard/dashboard-tabs/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/app/layouts/dashboard/dashboard-tabs/tab.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-details/activity-details.page.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-details/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-page/activity-page-presentation.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-page/components/action-list-item/index.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/activity/ui/activity-page/components/activity-filters/index.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/activity/ui/activity-page/components/activity-filters/styles.css.ts":
    [
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/activity/ui/activity-page/components/activity-icon/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-page/components/activity-item.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/activity-page/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/dashboard/activity/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/activity/ui/dashboard/activity/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow-transaction-flow/ui/complete.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow-transaction-flow/ui/review.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow-transaction-flow/ui/steps.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow-transaction-flow/ui/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/action-feedback/ui/notice.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/action-feedback/ui/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/amount-input/ui/amount-field.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/components/asset-selector.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/components/details-panel.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/components/form-details.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/components/market-select-modal.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/components/notices.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/layout.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/borrow-entry/ui/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/actions.page.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/components/collateral-list.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/components/ltv-gauge.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/components/metric-cards.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/components/skeletons.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/forms/amount-input-card.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/forms/repay-action-form.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/forms/withdraw-action-form.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/borrow/market-position/ui/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/compact/earn-page/components/select-provider/index.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/compact/earn-page/components/select-validator-section/select-validator-trigger.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/compact/earn-page/earn.page.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
  ],
  "src/features/earn/ui/compact/earn-page/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/earn-provider-option-selection.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/earn/ui/components/earn-provider-option-selection.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-opportunity-list-item/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-opportunity-list-item/styles.css.ts":
    [
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/components/select-token-section/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-token-section/select-token-list-item.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/components/select-token-section/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-yield-section/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-yield-section/select-opportunity.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/components/select-yield-section/select-yield-reward-details.tsx":
    ["design-system-owns-style-modules"],
  "src/features/earn/ui/components/select-yield-section/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/components/select-yield-section/use-animated-yield-percent-boundary.ts":
    ["design-system-owns-styling-libraries"],
  "src/features/earn/ui/dashboard/earn-details/components/earn-details-metrics.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/components/external-link-icon.tsx":
    [
      "no-html-element-outside-design-system",
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/components/history-chart-section.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/components/integration-docs-link.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/components/network-detail-value.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/components/provider-selection-card.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/earn/ui/dashboard/earn-details/earn-details-model.tsx": [
    "no-class-name-or-style-outside-design-system",
  ],
  "src/features/earn/ui/dashboard/earn-details/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/dashboard/earn-details/reward-rate-chart.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/dashboard/earn-details/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/dashboard/earn-page/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/earn/ui/dashboard/earn-page/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/compact/positions-page/positions.page.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/compact/positions-page/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/portfolio/ui/components/earn-position-list-item.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/components/position-list-item.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/components/summary-item/index.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/components/summary-item/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/dashboard/positions/components/positions-list-item.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/portfolio/ui/dashboard/positions/components/positions-section-header.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/portfolio/ui/dashboard/positions/positions.page.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/portfolio/ui/dashboard/positions/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/portfolio/ui/dashboard/summary/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/position-details/ui/compact/components/provider-details.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/position-details/ui/compact/position-details.page.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/position-details/ui/compact/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/position-details/ui/components/amount-block.tsx": [
    "no-html-element-outside-design-system",
  ],
  "src/features/position-details/ui/components/static-action-block.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/position-details/ui/components/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/position-details/ui/dashboard/components/position-details-action-tabs.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/position-details/ui/dashboard/components/position-details-hub.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/position-details/ui/dashboard/components/position-details-info.tsx":
    [
      "no-html-element-outside-design-system",
      "no-class-name-or-style-outside-design-system",
    ],
  "src/features/position-details/ui/dashboard/components/position-details-stake-actions.tsx":
    ["no-html-element-outside-design-system"],
  "src/features/position-details/ui/dashboard/components/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/preferences/ui/help-modal/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/preferences/ui/help-modal/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/preferences/ui/tos-modal/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/preferences/ui/tos-modal/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/account-modal/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/account-modal/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/chain-modal/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/chain-modal/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/connect-modal/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/connect-modal/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/wallet-dialog/avatar.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/wallet/ui/wallet-dialog/avatar.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/wallet-dialog/chain-icon.tsx": [
    "no-class-name-or-style-outside-design-system",
  ],
  "src/features/wallet/ui/wallet-dialog/icons.tsx": [
    "no-html-element-outside-design-system",
  ],
  "src/features/wallet/ui/wallet-dialog/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/wallet/ui/wallet-dialog/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/animation-layout.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/animation-page.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/app-container.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/compact-layout/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/compact-layout/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/details/components/tab.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/details/components/tabs.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/details/details.page.tsx": [
    "no-html-element-outside-design-system",
    "design-system-owns-styling-libraries",
  ],
  "src/features/widget-shell/ui/compact/details/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/header/index.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/compact/header/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/dashboard/header.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/dashboard/split-view/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/dashboard/split-view/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/dashboard/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/layout.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/mount-animated-page.tsx": [
    "no-html-element-outside-design-system",
    "design-system-owns-styling-libraries",
  ],
  "src/features/widget-shell/ui/page-container.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/page-cta.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/powered-by.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/rich-error-modal/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/rich-error-modal/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/widget-shell/ui/shell-notice/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/shell-notice/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/under-maintenance/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/widget-shell/ui/under-maintenance/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/widget-shell/views.ts": ["design-system-owns-style-modules"],
  "src/features/yield-entry/ui/components/confidential-token-balance.tsx": [
    "no-html-element-outside-design-system",
  ],
  "src/features/yield-entry/ui/components/select-validator/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-entry/ui/components/select-validator/meta-info.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-entry/ui/components/select-validator/select-validator-list.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-entry/ui/components/select-validator/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/estimated-reward-amounts/index.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-summary/ui/components/estimated-reward-amounts/styles.css.ts":
    [
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-summary/ui/components/kyc-gate-card/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/kyc-gate-card/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/kyc-gate-card/verification-modal.tsx":
    [
      "no-html-element-outside-design-system",
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-summary/ui/components/meta-info/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/meta-info/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/features/yield-summary/ui/components/reward-token-details/get-reward-token-symbols.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-summary/ui/components/reward-token-details/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/reward-token-details/style.css.ts":
    [
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-summary/ui/components/reward-token-details/symbol.css.ts":
    ["design-system-owns-styling-libraries"],
  "src/features/yield-summary/ui/components/yield-details-header/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/yield-details-header/styles.css.ts":
    ["design-system-owns-styling-libraries"],
  "src/features/yield-summary/ui/components/yield-risk/index.tsx": [
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/ui/components/yield-risk/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-summary/views.ts": ["design-system-owns-style-modules"],
  "src/features/yield-transaction-flow/ui/complete/pages/common.page.tsx": [
    "no-html-element-outside-design-system",
    "design-system-owns-styling-libraries",
  ],
  "src/features/yield-transaction-flow/ui/review/pages/common-page/common.page.tsx":
    [
      "no-html-element-outside-design-system",
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-transaction-flow/ui/review/pages/common-page/components/review-top-section.tsx":
    [
      "no-html-element-outside-design-system",
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-styling-libraries",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-transaction-flow/ui/review/pages/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-transaction-flow/ui/review/pages/unstake-sign-popup.tsx":
    [
      "no-class-name-or-style-outside-design-system",
      "design-system-owns-style-modules",
    ],
  "src/features/yield-transaction-flow/ui/steps/pages/common.page.tsx": [
    "no-html-element-outside-design-system",
    "no-class-name-or-style-outside-design-system",
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/features/yield-transaction-flow/ui/steps/pages/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/recipe-variant.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/styles/theme/atoms.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/styles/theme/contract.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/styles/theme/global.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/theme/properties.ts": ["design-system-owns-style-modules"],
  "src/shared/styles/theme/status-tint.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/theme/variant-overrides/finery.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/theme/variant-overrides/porto.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/theme/variant-overrides/utila.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/tokens/breakpoints.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/tokens/colors/values.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/styles/tokens/containers.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/components/amount-token-section/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/amount-token-section/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/chip-button/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/chip-button/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/collapsible/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/collapsible/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/components/dashboard-details/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/details-section/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/details-section/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/divider/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/divider/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/dropdown/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/dropdown/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/number-input/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/number-input/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/number-input/use-auto-resize-text.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/position-details/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/position-details/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/select-modal/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/select-modal/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/selected-token/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/token-icon/network-icon-image/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/token-icon/network-icon-image/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/components/token-icon/props.ts": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/token-icon/token-icon-image/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/tooltip/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/tooltip/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/transaction-steps/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/transaction-steps/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/virtual-list/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/components/virtual-list/style.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/primitives/anchor/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/anchor/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/box/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/button/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/button/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/content-loader/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/copy-text/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/copy-text/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/primitives/header-badge/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/header-badge/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/highlight/index.tsx": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/primitives/icons/arrow.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/arrows-left-right.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/caret-down.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/caret-left.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/check-circle.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/check-steps.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/check.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/clock-clock-wise.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/copy.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/external-link.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/gift.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/help.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/info.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/preferred.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/search.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/warning.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/icons/x-icon.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/image/index.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/link/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/link/styles.css.ts": [
    "design-system-owns-styling-libraries",
  ],
  "src/shared/ui/primitives/list/list-item.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/list/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/spinner/index.tsx": [
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/spinner/style.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/typography/heading.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/typography/styles.css.ts": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
  "src/shared/ui/primitives/typography/text.tsx": [
    "design-system-owns-styling-libraries",
    "design-system-owns-style-modules",
  ],
};
