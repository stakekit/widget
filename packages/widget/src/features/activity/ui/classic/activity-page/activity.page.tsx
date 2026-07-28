import { motion } from "motion/react";
import { useMountAnimation } from "../../../../mount-animation/state";
import { PageContainer } from "../../../../widget-shell/components";
import { ActivityPageContent } from "../../activity-page/activity-page-content";

export const AnimatedActivityPage = () => {
  const { mountAnimationFinished } = useMountAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, translateY: "-10px" }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 1.5,
      }}
    >
      <PageContainer>
        <ActivityPageContent resumeMode="start-and-navigate" />
      </PageContainer>
    </motion.div>
  );
};
