import { normalizeWidgetApiConfig } from "../../services/config/widget-config";

/**
 * The complete identity of an application runtime generation.
 *
 * API identity and mount-time feature configuration create fresh application
 * state. Live host callbacks and wallet topology have narrower lifecycles.
 */
export const makeWidgetRuntimeGenerationKey = (
  settings: Parameters<typeof normalizeWidgetApiConfig>[0]
): string => {
  const { apiKey, baseUrl, borrowApiUrl, yieldsApiUrl } =
    normalizeWidgetApiConfig(settings);

  return JSON.stringify([
    apiKey,
    baseUrl,
    borrowApiUrl,
    yieldsApiUrl,
    settings.borrowEnabled,
  ]);
};
