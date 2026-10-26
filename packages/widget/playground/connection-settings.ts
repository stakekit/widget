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

export const readConnectionSettings = (): ConnectionSettings =>
  decodeConnectionSettings(localStorage.getItem(storageKey) ?? "").pipe(
    Option.getOrElse(() => ({
      apiKey: "",
      apiUrl: "",
      yieldsApiUrl: "",
      borrowApiUrl: "",
    }))
  );

export const saveConnectionSettings = (settings: ConnectionSettings) =>
  localStorage.setItem(storageKey, JSON.stringify(settings));
