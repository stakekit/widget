import { normalizeWidgetApiConfig } from "./widget-config";

/**
 * The complete identity of an application runtime generation.
 *
 * Keep this deliberately API-only: live host callbacks and wallet topology
 * have narrower lifecycles and must not dispose application state.
 */
export const makeWidgetRuntimeGenerationKey = (
  settings: Parameters<typeof normalizeWidgetApiConfig>[0]
): string => {
  const { apiKey, baseUrl, borrowApiUrl, yieldsApiUrl } =
    normalizeWidgetApiConfig(settings);

  return JSON.stringify([apiKey, baseUrl, borrowApiUrl, yieldsApiUrl]);
};
