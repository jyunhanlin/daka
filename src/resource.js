const { subMinutes } = require('date-fns');

const { DELAY_START_MINS, DELAY_END_MINS } = require('./env.js');

const CST_TIMEZONE_OFFSET = -480;

const getCSTDate = (date) =>
  subMinutes(
    date,
    date.getTimezoneOffset() !== 0
      ? date.getTimezoneOffset()
      : CST_TIMEZONE_OFFSET
  );

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
const HOUR = TODAY.getUTCHours();
const SESSION_LIFE_TIME = Math.floor(TODAY.getTime() / 1000) + 1800; // copy from femas javascript

const delay = () => {
  const delayMinutes =
    HOUR >= 12
      ? getRandomMinute(DELAY_START_MINS, DELAY_END_MINS)
      : getRandomMinute(0, DELAY_START_MINS);

  console.log(`daka delay ${(delayMinutes / 60).toFixed(2)} mins`);

  return new Promise((resolve) => {
    setTimeout(resolve, delayMinutes * 1000);
  });
};

module.exports = {
  CST_TIMEZONE_OFFSET,
  SESSION_LIFE_TIME,
  UTC_TODAY,
  TODAY,
  HOUR,
  getCSTDate,
  format,
  getRandomMinute,
  delay,
};
