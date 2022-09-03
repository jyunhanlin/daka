const DOMAIN = process.env.FEMAS_DOMAIN;
const USER_NAME = process.env.FEMAS_USERNAME;
const USER_PASSWORD = process.env.FEMAS_PASSWORD;
const IMMEDIATE_DAKA = process.env.IMMEDIATE_DAKA
  ? process.env.IMMEDIATE_DAKA !== 'false'
  : false;
const DELAY_START_MINS = +process.env.DELAY_START_MINS || 5;
const DELAY_END_MINS = +process.env.DELAY_END_MINS || 15;
const MAX_RETRY_COUNT = +process.env.MAX_RETRY_COUNT || 3;

module.exports = {
  DOMAIN,
  USER_NAME,
  USER_PASSWORD,
  IMMEDIATE_DAKA,
  DELAY_START_MINS,
  DELAY_END_MINS,
  MAX_RETRY_COUNT,
};
