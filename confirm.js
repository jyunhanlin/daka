const { format, startOfMonth, endOfMonth, eachDayOfInterval, subMinutes } = require('date-fns');

const TODAY = new Date();
const timezoneOffset = TODAY.getTimezoneOffset() !== 0 ? TODAY.getTimezoneOffset() : -480;
const TODAY_WITH_TIMEZONE = subMinutes(TODAY, timezoneOffset);

const hours = TODAY.getUTCHours();
const hours2 = TODAY_WITH_TIMEZONE.getUTCHours();

const startDayOfMonth = format(startOfMonth(TODAY_WITH_TIMEZONE), 'yyyy-MM-dd');
const lastDayOfMonth = format(endOfMonth(TODAY_WITH_TIMEZONE), 'yyyy-MM-dd');

const dakaDay = format(TODAY, 'yyyy-MM-dd');

console.log({
  TODAY,
  TODAY_WITH_TIMEZONE,
  hours,
  hours2,
  startDayOfMonth,
  lastDayOfMonth,
  dakaDay,
});
