import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { GeoBlockService } from "../../../services/geoblocking";

const geoBlockResultAtom = appRuntime
  .atom(
    GeoBlockService.use((geoBlock) => Effect.succeed(geoBlock.states)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("geoBlockResultAtom"));

export const geoBlockAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(geoBlockResultAtom), () => false as const)
).pipe(Atom.withLabel("geoBlockAtom"));
