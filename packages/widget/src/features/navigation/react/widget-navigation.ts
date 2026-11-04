import { Option } from "effect";
import type { MouseEvent } from "react";
import {
  useHref,
  useLinkClickHandler,
  useLocation,
  useNavigate,
} from "react-router";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "../../../services/navigation/widget-routes";

type RouteMatcher<Params> = Readonly<{
  readonly match: (pathname: string) => Option.Option<Params>;
  readonly matchPrefix: (pathname: string) => Option.Option<Params>;
}>;

type RouteState<State> = Readonly<{
  readonly state: (locationState: unknown) => Option.Option<State>;
}>;

/** Navigates to registry paths and locations from React. */
export const useWidgetNavigate = () => {
  const navigate = useNavigate();
  return {
    back: () => navigate(-1),
    push: (to: WidgetNavigationTarget) =>
      navigate(widgetTargetPath(to), { state: widgetTargetState(to) }),
    replace: (to: WidgetNavigationTarget) =>
      navigate(widgetTargetPath(to), {
        replace: true,
        state: widgetTargetState(to),
      }),
  } as const;
};

/** What an anchor needs to navigate within the Widget's router. */
export type WidgetLinkProps = {
  readonly href: string;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * The `href` and click handler that make an anchor a router link to a
 * registry path or location: a plain click navigates in the Widget, a
 * modified click keeps the browser's behavior.
 */
export const useWidgetLinkProps = (
  to: WidgetNavigationTarget,
  options?: { readonly viewTransition?: boolean }
): WidgetLinkProps => {
  const path = widgetTargetPath(to);
  const href = useHref(path);
  const onClick = useLinkClickHandler<HTMLAnchorElement>(path, {
    state: widgetTargetState(to),
    viewTransition: options?.viewTransition ?? false,
  });
  return { href, onClick };
};

/** The route's params while the current location is exactly that route. */
export const useWidgetRouteMatch = <Params>(
  route: RouteMatcher<Params>
): Params | null => Option.getOrNull(route.match(useLocation().pathname));

/** The route's params while the current location is that route or inside it. */
export const useWidgetRoutePrefixMatch = <Params>(
  route: RouteMatcher<Params>
): Params | null => Option.getOrNull(route.matchPrefix(useLocation().pathname));

/** The current location's state, decoded as the route's bound state. */
export const useWidgetRouteState = <State>(
  route: RouteState<State>
): State | null => Option.getOrNull(route.state(useLocation().state));
