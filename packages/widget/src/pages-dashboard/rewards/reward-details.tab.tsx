// import { Box } from "../../components/atoms/box";
// import { Dropdown } from "../../components/atoms/dropdown";
// import { Text } from "../../components/atoms/typography/text";
// import { useRewardDetails } from "./hooks/use-reward-details-tab.hook";
// import { formatNumber } from "../../utils";
// import {
//   ArcElement,
//   Chart as ChartJS,
//   Colors,
//   Legend,
//   Tooltip,
// } from "chart.js";
// import annotationPlugin, {
//   type DoughnutLabelOptions,
// } from "chartjs-plugin-annotation";
// import { useMemo, useState } from "react";
// import { Doughnut } from "react-chartjs-2";
// import { useTranslation } from "react-i18next";

// ChartJS.register(ArcElement, Tooltip, Legend, Colors, annotationPlugin);

// export const RewardsDetailsTab = () => {
//   const {
//     rewardsPositionsQuery, allPositionsQuery } = useRewardDetails();

//   const [selectedOption, setSelectedOption] = useState<
//     | { label: "Positions"; value: "positions" }
//     | { label: "Rewards"; value: "rewards" }
//   >({ label: "Positions", value: "positions" });

//   const dataToUse = useMemo(() => {
//     return (
//       (selectedOption.value === "positions"
//         ? allPositionsQuery.data?.allPositions.map((v) => ({
//             name: v.providerDetails.mapOrDefault(
//               (pd) => `${v.yieldName} - ${pd.name ?? pd.address}`,
//               v.yieldName
//             ),
//             value: v.usdAmount,
//           }))
//         : rewardsPositionsQuery.data?.rewardsPositions.map((v) => ({
//             name: v.yieldName,
//             value: v.total.toNumber(),
//           }))) ?? []
//     );
//   }, [
//     allPositionsQuery.data,
//     rewardsPositionsQuery.data,
//     selectedOption.value,
//   ]);

//   const data = useMemo(() => {
//     return {
//       labels: dataToUse.map((v) => v.name),
//       datasets: [
//         {
//           label: "Position value in USD",
//           data: dataToUse.map((v) => v.value),
//           backgroundColor: dataToUse.map(
//             (_, i) => colors[i % colors.length].background
//           ),
//           borderColor: dataToUse.map(
//             (_, i) => colors[i % colors.length].borderColor
//           ),
//           borderWidth: 1,
//         },
//       ],
//     };
//   }, [dataToUse]);

//   const { t } = useTranslation();

//   return (
//     <Box
//       alignSelf="stretch"
//       flex={1}
//       px="4"
//       py="4"
//       display="flex"
//       justifyContent="center"
//       alignItems="stretch"
//       flexDirection="column"
//     >
//       <Box>
//         <Dropdown
//           options={
//             [
//               { label: "Positions", value: "positions" },
//               { label: "Rewards", value: "rewards" },
//             ] as const
//           }
//           onSelect={(val) =>
//             setSelectedOption(
//               val === "positions"
//                 ? { label: "Positions", value: "positions" }
//                 : { label: "Rewards", value: "rewards" }
//             )
//           }
//           selectedOption={selectedOption}
//           placeholder="Select an option"
//         />
//       </Box>
//       <Box display="flex" alignItems="center" justifyContent="center" flex={1}>
//         {dataToUse.length > 0 ? (
//           <Doughnut
//             data={data}
//             options={{
//               plugins: {
//                 tooltip: {
//                   callbacks: {
//                     label: (context: { label: string; parsed: number }) =>
//                       `$${formatNumber(context.parsed, 2)}`,
//                   },
//                 },
//                 annotation: {
//                   annotations: {
//                     dLabel: {
//                       type: "doughnutLabel",
//                       content: ({ chart }) => [
//                         `Total: ${formatNumber((chart.getDatasetMeta(0) as { total: number }).total, 2)}$`,
//                       ],
//                       font: [{ size: 30 }],
//                       color: ["#373737"],
//                     } as DoughnutLabelOptions,
//                   },
//                 },
//               },
//             }}
//           />
//         ) : (
//           <Text variant={{ size: "large" }}>
//             {t("dashboard.rewards.no_data")}
//           </Text>
//         )}
//       </Box>
//     </Box>
//   );
// };

// const colors = [
//   {
//     background: "rgba(255, 99, 132, 0.2)",
//     borderColor: "rgba(255, 99, 132, 1)",
//   },
//   {
//     background: "rgba(54, 162, 235, 0.2)",
//     borderColor: "rgba(54, 162, 235, 1)",
//   },
//   {
//     background: "rgba(255, 206, 86, 0.2)",
//     borderColor: "rgba(255, 206, 86, 1)",
//   },
//   {
//     background: "rgba(75, 192, 192, 0.2)",
//     borderColor: "rgba(75, 192, 192, 1)",
//   },
//   {
//     background: "rgba(153, 102, 255, 0.2)",
//     borderColor: "rgba(153, 102, 255, 1)",
//   },
//   {
//     background: "rgba(255, 159, 64, 0.2)",
//     borderColor: "rgba(255, 159, 64, 1)",
//   },
//   {
//     background: "rgba(255, 105, 180, 0.2)",
//     borderColor: "rgba(255, 105, 180, 1)",
//   },
//   {
//     background: "rgba(60, 179, 113, 0.2)",
//     borderColor: "rgba(60, 179, 113, 1)",
//   },
//   {
//     background: "rgba(255, 140, 0, 0.2)",
//     borderColor: "rgba(255, 140, 0, 1)",
//   },
// ];
