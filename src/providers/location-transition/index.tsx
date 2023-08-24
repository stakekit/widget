import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Location, useLocation } from "react-router-dom";
import { fadeIn, fadeOut } from "./style.css";
import { config } from "../../config";

const transitions = {
  fadeIn,
  fadeOut,
};

const LocationTransitionContext = createContext<
  | {
      location: Location;
      displayLocation: Location;
      prevLocationPathName: Location["pathname"] | null;
      onAnimationEnd: () => void;
      transitionClassName: string;
    }
  | undefined
>(undefined);

export const LocationTransitionProvider = ({ children }: PropsWithChildren) => {
  const location = useLocation();

  const [locationP, setLocationP] = useState<Location["pathname"] | null>(null);
  const prevLocationPathName = useRef(locationP);

  if (location.pathname !== locationP) {
    prevLocationPathName.current = locationP;
    setLocationP(location.pathname);
  }

  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] =
    useState<keyof typeof transitions>("fadeIn");

  if (location !== displayLocation && transitionStage !== "fadeOut") {
    setTransitionStage("fadeOut");
  }

  const onAnimationEnd = useCallback(() => {
    if (transitionStage === "fadeOut") {
      setTransitionStage("fadeIn");

      setDisplayLocation(location);
    }
  }, [location, transitionStage]);

  const value = useMemo(
    () => ({
      location,
      displayLocation: config.isTestMode ? location : displayLocation,
      prevLocationPathName: config.isTestMode
        ? location.pathname
        : prevLocationPathName.current,
      onAnimationEnd,
      transitionClassName:
        transitionStage === "fadeIn" ? transitions.fadeIn : transitions.fadeOut,
    }),
    [
      displayLocation,
      location,
      onAnimationEnd,
      prevLocationPathName,
      transitionStage,
    ]
  );

  return (
    <LocationTransitionContext.Provider value={value}>
      {children}
    </LocationTransitionContext.Provider>
  );
};

export const useLocationTransition = () => {
  const value = useContext(LocationTransitionContext);

  if (value === undefined) {
    throw new Error(
      "useLocationTransition must be used within a LocationTransitionProvider"
    );
  }

  return value;
};
