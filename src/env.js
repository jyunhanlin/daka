const DOMAIN = process.env.FEMAS_DOMAIN;
const USER_NAME = process.env.FEMAS_USERNAME;
const USER_PASSWORD = process.env.FEMAS_PASSWORD;
const IMMEDIATE_DAKA = process.env.IMMEDIATE_DAKA
  ? process.env.IMMEDIATE_DAKA !== 'false'
  : false;
const DELAY_START_MINS = Number.isNaN(Number(process.env.DELAY_START_MINS))
  ? 5
  : +process.env.DELAY_START_MINS;
const DELAY_END_MINS = Number.isNaN(Number(process.env.DELAY_END_MINS))
  ? 15
  : +process.env.DELAY_END_MINS;
const MAX_RETRY_COUNT = Number.isNaN(Number(process.env.MAX_RETRY_COUNT))
  ? 3
  : +process.env.MAX_RETRY_COUNT;

module.exports = {
  DOMAIN,
  USER_NAME,
  USER_PASSWORD,
  IMMEDIATE_DAKA,
  DELAY_START_MINS,
  DELAY_END_MINS,
  MAX_RETRY_COUNT,
};
