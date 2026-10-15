import { MotionGlobalConfig } from "motion/react";
import { failOnReactErrors } from "./fail-on-react-errors";

MotionGlobalConfig.skipAnimations = true;
failOnReactErrors();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
