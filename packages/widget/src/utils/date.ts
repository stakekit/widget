import {
  type FormatDurationOptions,
  formatDuration,
  intervalToDuration,
} from "date-fns";

const getFormat = ({
  days,
  hours,
  minutes,
}: {
  days: number;
  hours: number;
  minutes: number;
}): FormatDurationOptions["format"] => {
  if (days >= 1) {
    return ["days"];
  }
  if (hours >= 1) {
    return ["hours"];
  }
  if (minutes >= 1) {
    return ["minutes"];
  }
  return ["seconds"];
};

export const formatDurationUntilDate = (futureDate: Date) => {
  const {
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0,
  } = intervalToDuration({
    start: new Date(),
    end: futureDate,
  });

  return formatDuration(
    { days, hours, minutes, seconds },
    { format: getFormat({ days, hours, minutes }) }
  );
};

export const dateOlderThen7Days = (date: string): boolean => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return new Date(date) < sevenDaysAgo;
};
