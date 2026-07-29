import type {
  WidgetApiConfig,
  WidgetConfig,
} from "../../services/config/widget-config";
import { normalizeWidgetApiConfig } from "../../services/config/widget-config";

type ApplicationRuntimeIdentity = WidgetApiConfig & {
  readonly borrowEnabled: boolean;
};
type ApplicationRuntimeIdentityField = keyof ApplicationRuntimeIdentity;

const runtimeIdentityFields = [
  "apiKey",
  "baseUrl",
  "borrowApiUrl",
  "borrowEnabled",
  "yieldsApiUrl",
] as const satisfies ReadonlyArray<ApplicationRuntimeIdentityField>;

const getApplicationRuntimeIdentity = (
  settings: WidgetConfig
): ApplicationRuntimeIdentity => ({
  ...normalizeWidgetApiConfig(settings),
  borrowEnabled: settings.borrowEnabled,
});

class ApplicationRuntimeIdentityChangedError extends Error {
  override readonly name = "ApplicationRuntimeIdentityChangedError";

  constructor(
    readonly changedFields: ReadonlyArray<ApplicationRuntimeIdentityField>
  ) {
    super(
      `Application Runtime identity changed after mount: ${changedFields.join(
        ", "
      )}. Unmount and remount the widget to apply these settings.`
    );
  }
}

export const assertApplicationRuntimeIdentity = (
  initial: WidgetConfig,
  current: WidgetConfig
): void => {
  const initialIdentity = getApplicationRuntimeIdentity(initial);
  const currentIdentity = getApplicationRuntimeIdentity(current);
  const changedFields = runtimeIdentityFields.filter(
    (field) => initialIdentity[field] !== currentIdentity[field]
  );

  if (changedFields.length > 0) {
    throw new ApplicationRuntimeIdentityChangedError(changedFields);
  }
};
