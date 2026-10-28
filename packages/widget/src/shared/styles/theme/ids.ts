export const id = "stakekit";
export const rootSelector = `[data-rk="${id}"]`;

/**
 * The Layout attribute: the app container carries it, and portaled kit roots
 * repeat it, so Layout-specific styles are plain CSS selectors.
 */
export const layoutAttribute = "data-sk-layout";
export type LayoutAttributeValue = "compact" | "dashboard";
export const compactLayoutSelector = `[${layoutAttribute}="compact"]`;
export const dashboardLayoutSelector = `[${layoutAttribute}="dashboard"]`;
