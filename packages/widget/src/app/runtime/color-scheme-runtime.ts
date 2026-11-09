import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import {
  ColorSchemePreference,
  type PreferredColorScheme,
} from "../../services/color-scheme-preference";

/**
 * Its own runtime, apart from the Application Runtime, so the
 * widget-unavailable notice, which renders without one, follows the
 * preference too.
 */
const colorSchemePreferenceRuntime = Atom.runtime(ColorSchemePreference.layer);

const preferenceResultAtom = colorSchemePreferenceRuntime
  .atom(
    ColorSchemePreference.use((preference) =>
      Effect.succeed(preference.changes)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.keepAlive, Atom.withLabel("preferenceResultAtom"));

/** The operating system's color scheme, live; light until it is known. */
export const preferredColorSchemeAtom = Atom.make(
  (get): PreferredColorScheme =>
    AsyncResult.getOrElse(get(preferenceResultAtom), () => "light" as const)
).pipe(Atom.withLabel("preferredColorSchemeAtom"));
