import type { Dispatch, PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { Action } from "../../types";
import { useSettings } from "../settings";
import { useSavedRef } from "../../hooks";
import { delayAPIRequests } from "../../common/delay-api-requests";
import { useSKLocation } from "../location";
import { config } from "../../config";

type State = {
  layout: boolean;
  earnPage: boolean;
};

type Actions = Action<"layout" | "earnPage" | "all">;

const initialState = (): State =>
  config.env.isTestMode
    ? { layout: true, earnPage: true }
    : {
        earnPage: false,
        layout: false,
      };

const reducer = (state: State, actions: Actions): State => {
  switch (actions.type) {
    case "layout":
      return { ...state, layout: true };
    case "earnPage":
      return { ...state, earnPage: true };
    case "all":
      return { layout: true, earnPage: true };
    default:
      return state;
  }
};

type ContextValue = {
  state: State;
  mountAnimationFinished: boolean;
  dispatch: Dispatch<{ type: keyof State }>;
};

const MountAnimationContext = createContext<ContextValue | undefined>(
  undefined
);

const removeDelay = delayAPIRequests();

export const MountAnimationProvider = ({ children }: PropsWithChildren) => {
  const onMountAnimationCompleteRef = useSavedRef(
    useSettings().onMountAnimationComplete
  );
  const [state, dispatch] = useReducer(reducer, initialState());

  useEffect(() => {
    if (state.layout && state.earnPage) {
      removeDelay();
      onMountAnimationCompleteRef.current?.();
    }
  }, [onMountAnimationCompleteRef, state.earnPage, state.layout]);

  const { current } = useSKLocation();

  useEffect(() => {
    if (current.pathname !== "/") {
      dispatch({ type: "all" });
    }
  }, [current.pathname, dispatch]);

  const mountAnimationFinished = state.layout && state.earnPage;

  const value = useMemo(
    () => ({ dispatch, state, mountAnimationFinished }) satisfies ContextValue,
    [mountAnimationFinished, state]
  );

  return (
    <MountAnimationContext.Provider value={value}>
      {children}
    </MountAnimationContext.Provider>
  );
};

export const useMountAnimation = () => {
  const context = useContext(MountAnimationContext);

  if (!context) {
    throw new Error(
      "useMountAnimation must be used within a MountAnimationProvider"
    );
  }

  return context;
};
