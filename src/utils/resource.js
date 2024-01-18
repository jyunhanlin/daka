const { subMinutes, eachDayOfInterval } = require('date-fns');

const CST_TIMEZONE_OFFSET = -480;

const getCSTDate = (date) =>
  subMinutes(
    date,
    date.getTimezoneOffset() !== 0
      ? date.getTimezoneOffset()
      : CST_TIMEZONE_OFFSET
  );

const getDaysArray = (start, end) =>
  eachDayOfInterval({
    start: new Date(start),
    end: new Date(end),
  }).map((day) => format(getCSTDate(day)));

const format = (date) => {
  return date.toISOString().split('T')[0];
};

const getRandomMinute = (min, max) => {
  const minMinute = min * 60;
  const maxMinute = max * 60;
  return Math.floor(Math.random() * (maxMinute - minMinute + 1)) + minMinute;
};

const UTC_TODAY = new Date();
const TODAY = getCSTDate(UTC_TODAY);
const YEAR = TODAY.getUTCFullYear();
const MONTH = UTC_TODAY.getUTCMonth() + 1;
const DAY = TODAY.getUTCDate();
const HOUR = TODAY.getUTCHours();
const MINUTE = TODAY.getUTCMinutes();

const delay = ({ punchType, delayStartMins, delayEndMins }) => {
  const delayMins =
    punchType === 'E'
      ? getRandomMinute(delayStartMins, delayEndMins)
      : getRandomMinute(0, delayStartMins);

  if (delayMins) console.log(`daka delay ${(delayMins / 60).toFixed(2)} mins`);

  return sleep(delayMins * 1000);
};

const sleep = (msecs) => new Promise((resolve) => setTimeout(resolve, msecs));

const parseCookies = (setCookie) =>
  setCookie.map((cookie) => `${cookie.split(';')[0]};`).join('');

const checkPersonalEvents = ({
  events = [],
  today = '',
  hour = '',
  min = '',
  punchType = '',
} = {}) => {
  const personalEvents = events.reduce((acc, cur) => {
    const start = cur.startDateTime.split('T');
    const end = cur.endDateTime.split('T');

    const startDate = start[0];
    const startTime = start[1].split(':');
    const startHour = startTime[0];
    const startMin = startTime[1];

    const endDate = end[0];
    const endTime = end[1].split(':');
    const endHour = endTime[0];
    const endMin = endTime[1];

    let events = [];

    if (startDate === endDate) {
      events.push({
        date: startDate,
        startHour,
        startMin,
        endHour,
        endMin,
      });
    } else {
      const days = getDaysArray(startDate, endDate);

      days.forEach((day) => {
        let event = {
          date: day,
          startHour: '10',
          startMin: '00',
          endHour: '19',
          endMin: '00',
        };

        if (day === startDate) {
          event.startHour = startHour;
          event.startMin = startMin;
        } else if (day === endDate) {
          event.endHour = endHour;
          event.endMin = endMin;
        }

        events.push(event);
      });
    }

    return acc.concat(events);
  }, []);

  for (let i = 0; i < personalEvents.length; i += 1) {
    const { date, startHour, startMin, endHour, endMin } = personalEvents[i];

    if (date === today) {
      // all-day
      const isAllDay = Number(endHour) - Number(startHour) >= 9;
      if (isAllDay) return true;

      // between start and end
      if (startHour <= hour && hour <= endHour) return true;

      // before start or after end
      if (punchType === 'S') {
        const timeDiff =
          (Number(startHour) - Number(hour)) * 60 +
          (Number(startMin) - Number(min));

        if (timeDiff <= 60) return true;
      } else if (punchType === 'E') {
        const timeDiff =
          (Number(hour) - Number(endHour)) * 60 +
          (Number(min) - Number(endMin));

        if (timeDiff <= 60) return true;
      }
    }
  }

  return false;
};

module.exports = {
  CST_TIMEZONE_OFFSET,
  UTC_TODAY,
  TODAY,
  YEAR,
  MONTH,
  DAY,
  HOUR,
  MINUTE,
  getCSTDate,
  getDaysArray,
  format,
  getRandomMinute,
  delay,
  sleep,
  parseCookies,
  checkPersonalEvents,
};
