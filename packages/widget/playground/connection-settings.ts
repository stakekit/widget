/**
 * API key and API URL overrides, kept in this browser's localStorage rather
 * than the page link so shared links never carry keys. Empty means the
 * env default (`VITE_API_KEY`, `VITE_API_URL`, ...).
 */
import { Option, Schema } from "effect";

const ConnectionSettingsSchema = Schema.Struct({
  apiKey: Schema.String,
  apiUrl: Schema.String,
  yieldsApiUrl: Schema.String,
  borrowApiUrl: Schema.String,
});

export type ConnectionSettings = typeof ConnectionSettingsSchema.Type;

const storageKey = "sk-playground:connection";

const decodeConnectionSettings = Schema.decodeUnknownOption(
  Schema.fromJsonString(ConnectionSettingsSchema)
);

/** Widget props that carry connection settings. They come only from here, never from a link. */
export const connectionProps: ReadonlyArray<string> = [
  "apiKey",
  "baseUrl",
  "yieldsApiUrl",
  "borrowApiUrl",
];

const noOverrides: ConnectionSettings = {
  apiKey: "",
  apiUrl: "",
  yieldsApiUrl: "",
  borrowApiUrl: "",
};

// Storage can be blocked (privacy settings, sandboxed frames); the playground
// then runs on the env defaults instead of failing to start.
export const readConnectionSettings = (): ConnectionSettings => {
  try {
    return decodeConnectionSettings(
      localStorage.getItem(storageKey) ?? ""
    ).pipe(Option.getOrElse(() => noOverrides));
  } catch (error) {
    console.warn("[playground] Cannot read connection settings", error);
    return noOverrides;
  }
};

export const saveConnectionSettings = (settings: ConnectionSettings) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch (error) {
    console.warn("[playground] Cannot save connection settings", error);
  }
};
