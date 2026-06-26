import {
  BrowserClient,
  defaultStackParser,
  type ErrorEvent,
  makeFetchTransport,
  Scope,
} from "@sentry/react";
import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { RichErrorModal } from "../../components/molecules/rich-error-modal";
import { config } from "../../config";
import { useSKLocation } from "../location";
import { useSettings } from "../settings";
import { useSKWallet } from "../sk-wallet";

const betterStackDsn =
  "https://k3dgyiYydYXyFwe7MPsNWk3N@s2546777.us-east-9.betterstackdata.com/2546777";

type WidgetErrorContext = {
  walletAddress?: string;
  network?: string;
  chainId?: number;
  route?: string;
  variant?: string;
  mode?: "dashboard" | "widget";
};

type CaptureDetails = {
  mechanism: string;
  componentStack?: string;
  handled?: boolean;
};

type ErrorTrackingState = {
  client: BrowserClient;
  scope: Scope;
};

let errorTrackingState: ErrorTrackingState | null = null;
let latestWidgetContext: WidgetErrorContext = {};
const capturedErrorObjects = new WeakSet<object>();

const sensitiveKeyPattern =
  /authorization|password|secret|private[-_]?key|seed|mnemonic|rawarguments|unsignedtransaction|signedtx|payload|balance|amount/i;

const redacted = "[Filtered]";

const redactedString = (value: string) =>
  value
    .replace(/(authorization)(["'`\s:=]+)([^"',\s}]+)/gi, `$1$2${redacted}`)
    .replace(/(https?:\/\/)([^@\s]+)@/gi, `$1${redacted}@`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const scrubValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") {
    return redactedString(value);
  }

  if (depth > 4) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, innerValue]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? redacted
        : scrubValue(innerValue, depth + 1),
    ])
  );
};

const scrubEvent = (event: ErrorEvent): ErrorEvent => ({
  ...event,
  breadcrumbs: undefined,
  contexts: scrubValue(event.contexts) as ErrorEvent["contexts"],
  extra: scrubValue(event.extra) as ErrorEvent["extra"],
  request: scrubValue(event.request) as ErrorEvent["request"],
});

const beforeSend = (event: ErrorEvent) => scrubEvent(event);

const getErrorTrackingState = () => {
  if (!errorTrackingState) {
    const client = new BrowserClient({
      dsn: betterStackDsn,
      enabled: !config.env.isTestMode,
      environment: import.meta.env.MODE,
      integrations: [],
      maxBreadcrumbs: 0,
      normalizeDepth: 4,
      sendDefaultPii: false,
      stackParser: defaultStackParser,
      tracesSampleRate: undefined,
      transport: makeFetchTransport,
      beforeSend,
    });
    const scope = new Scope();

    client.init();
    scope.setClient(client);

    errorTrackingState = { client, scope };
  }

  return errorTrackingState;
};

const setTag = (
  scope: Scope,
  key: string,
  value: string | number | boolean | undefined
) => {
  if (value === undefined) {
    return;
  }

  scope.setTag(key, value);
};

const applyWidgetContext = (scope: Scope, details: CaptureDetails) => {
  const context = latestWidgetContext;

  scope.setLevel("error");
  scope.setTag("widget", "stakekit");
  setTag(scope, "widget.mode", context.mode);
  setTag(scope, "widget.variant", context.variant);
  setTag(scope, "widget.route", context.route);
  setTag(scope, "walletAddress", context.walletAddress);
  setTag(scope, "wallet.network", context.network);
  setTag(scope, "wallet.chainId", context.chainId);

  if (context.walletAddress) {
    scope.setUser({ id: context.walletAddress });
  }

  scope.setContext("stakekit_widget", {
    ...context,
    captureMechanism: details.mechanism,
  });

  if (context.walletAddress || context.network || context.chainId) {
    scope.setContext("wallet", {
      address: context.walletAddress,
      network: context.network,
      chainId: context.chainId,
    });
  }

  if (details.componentStack) {
    scope.setContext("react", {
      componentStack: details.componentStack,
    });
  }
};

const trackCapturedObject = (error: unknown) => {
  if (!isRecord(error)) {
    return false;
  }

  if (capturedErrorObjects.has(error)) {
    return true;
  }

  capturedErrorObjects.add(error);
  return false;
};

export const captureWidgetException = (
  error: unknown,
  details: CaptureDetails
) => {
  if (trackCapturedObject(error)) {
    return;
  }

  const state = getErrorTrackingState();

  if (!state) {
    return;
  }

  const scope = state.scope.clone();

  applyWidgetContext(scope, details);

  scope.captureException(error, {
    mechanism: {
      handled: details.handled ?? true,
      type: details.mechanism,
    },
  });
};

const updateWidgetErrorContext = (context: WidgetErrorContext) => {
  latestWidgetContext = context;
};

export const WidgetErrorDialog = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();

  return (
    <RichErrorModal
      action={{ label: t("error_modal.reload_app"), onClick: onRetry }}
      description={t("error_modal.unexpected_description")}
      error={null}
      isOpen
      onClose={onRetry}
    />
  );
};

class WidgetErrorBoundary extends Component<
  PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    captureWidgetException(error, {
      mechanism: "react-error-boundary",
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <WidgetErrorDialog onRetry={this.reset} />;
    }

    return this.props.children;
  }
}

export const ErrorTrackingProvider = ({ children }: PropsWithChildren) => (
  <WidgetErrorBoundary>{children}</WidgetErrorBoundary>
);

export const WidgetErrorTrackingContextSync = () => {
  const { dashboardVariant, variant } = useSettings();
  const { current } = useSKLocation();
  const wallet = useSKWallet();
  const chainId = wallet.chain?.id;
  const network = wallet.network ?? undefined;
  const walletAddress = wallet.address ?? undefined;

  useEffect(() => {
    updateWidgetErrorContext({
      chainId,
      mode: dashboardVariant ? "dashboard" : "widget",
      network,
      route: current.pathname,
      variant,
      walletAddress,
    });
  }, [
    chainId,
    current.pathname,
    dashboardVariant,
    network,
    variant,
    walletAddress,
  ]);

  return null;
};
