import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { applicationRouterRuntime } from "../../../app/runtime/application-router-runtime";
import type { SKHostConfiguration } from "../../../public-api/types";
import {
  selectWidgetBootstrapSnapshot,
  WidgetConfigService,
} from "../../../services/config/widget-config";
import type { WidgetConfig } from "../../../services/config/widget-config-model";
import { selectAtom } from "../../../shared/effect/select-atom";

const widgetConfigServiceAtom = applicationRouterRuntime
  .atom(Effect.service(WidgetConfigService))
  .pipe(Atom.keepAlive, Atom.withLabel("widgetConfigServiceAtom"));

const widgetConfigResultAtom = applicationRouterRuntime
  .atom(
    WidgetConfigService.use((config) => Effect.succeed(config.values)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("widgetConfigResultAtom"));

export const widgetConfigAtom = Atom.make(
  (get): WidgetConfig => AsyncResult.getOrThrow(get(widgetConfigResultAtom))
).pipe(Atom.withLabel("widgetConfigAtom"));

export const widgetConfigFieldAtom = Atom.family((field: keyof WidgetConfig) =>
  selectAtom(widgetConfigAtom, (settings) => settings[field])
);

export const widgetBootstrapSnapshotAtom = Atom.make((get) => {
  const settings = get(widgetConfigAtom);

  return selectWidgetBootstrapSnapshot(settings);
}).pipe(Atom.keepAlive, Atom.withLabel("widgetBootstrapSnapshotAtom"));

export const updateWidgetConfigAtom = applicationRouterRuntime
  .fn((hostConfiguration: SKHostConfiguration, context) =>
    context
      .result(widgetConfigServiceAtom)
      .pipe(Effect.flatMap((service) => service.update(hostConfiguration)))
  )
  .pipe(Atom.withLabel("updateWidgetConfigAtom"));
