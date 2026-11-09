import { Component, type ReactNode } from "react";
import { decodeRejectedConfigurationPresentation } from "../../services/config/widget-config-boundary";
import { StandaloneWidgetUnavailable } from "./standalone-widget-unavailable";

type WidgetErrorBoundaryProps = Readonly<{
  children: ReactNode;
  /** The raw Host Configuration, decoded only for the notice's look. */
  hostConfiguration: Parameters<
    typeof decodeRejectedConfigurationPresentation
  >[0];
}>;

type WidgetErrorBoundaryState = Readonly<{ failed: boolean }>;

/**
 * The outermost error boundary inside the Widget root. It catches what the
 * route error boundary cannot: errors in the atom registry, the providers and
 * router above the routes, host children, and the route error view itself.
 * Its notice depends on no runtime, since the runtime may be what failed.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  override state: WidgetErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <StandaloneWidgetUnavailable
        presentation={decodeRejectedConfigurationPresentation(
          this.props.hostConfiguration
        )}
      />
    );
  }
}
