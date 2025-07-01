// import { Box } from "../../components/atoms/box";
// import { AnimationPage } from "../../navigation/containers/animation-page";
// import { VerticalDivider } from "../common/components/divider";
// import { TabPageContainer } from "../common/components/tab-page-container";
// import { Summary } from "./components/summary";
// import { RewardsPage } from "./rewards.page";
// import { rewardDetailsContainer } from "./styles.css";
// import { lazy } from "react";

// const RewardsDetailsTab = lazy(() =>
//   import("./reward-details.tab").then((mod) => ({
//     default: mod.RewardsDetailsTab,
//   }))
// );

// export const RewardsTabPage = () => {
//   return (
//     <AnimationPage>
//       <Box display="flex" flexDirection="column" gap="4">
//         <Summary />

//         <TabPageContainer>
//           <RewardsPage />

//           <VerticalDivider />

//           <Box flex={1} width="0" className={rewardDetailsContainer}>
//             <RewardsDetailsTab />
//           </Box>
//         </TabPageContainer>
//       </Box>
//     </AnimationPage>
//   );
// };
