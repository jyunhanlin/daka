const DOMAIN = process.env.FEMAS_DOMAIN;
const USER_NAME = process.env.FEMAS_USERNAME;
const USER_PASSWORD = process.env.FEMAS_PASSWORD;
const IMMEDIATE_DAKA = process.env.IMMEDIATE_DAKA || false;
const DELAY_START_MINS = process.env.DELAY_START_MINS || 5;
const DELAY_END_MINS = process.env.DELAY_END_MINS || 15;
const MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;
const CST_TIMEZONE_OFFSET = -480;
const SESSION_LIFE_TIME = Math.floor(new Date().getTime() / 1000) + 1800; // copy from femas javascript

module.exports = {
  DOMAIN,
  USER_NAME,
  USER_PASSWORD,
  IMMEDIATE_DAKA,
  DELAY_START_MINS,
  DELAY_END_MINS,
  MAX_RETRY_COUNT,
  CST_TIMEZONE_OFFSET,
  SESSION_LIFE_TIME,
};
