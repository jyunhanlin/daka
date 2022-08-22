const { subMinutes } = require('date-fns');

const {
  DELAY_START_MINS,
  DELAY_END_MINS,
  CST_TIMEZONE_OFFSET,
} = require('./constants.js');

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

const delay = () => {
  const delayMinutes =
    HOUR >= 12
      ? getRandomMinute(DELAY_START_MINS, DELAY_END_MINS)
      : getRandomMinute(0, DELAY_START_MINS);

  console.log(`daka delay ${delayMinutes / 60} mins`);

  return new Promise((resolve) => {
    setTimeout(resolve, delayMinutes * 1000);
  });
};

module.exports = {
  getCSTDate,
  format,
  getRandomMinute,
  delay,
  UTC_TODAY,
  TODAY,
  HOUR,
};
