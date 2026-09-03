import { MotionGlobalConfig } from "motion/react";

MotionGlobalConfig.skipAnimations = true;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
