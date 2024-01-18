const MODULE = process.env.MODULE;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const MODULE_OPTIONS = process.env.MODULE_OPTIONS;

const IMMEDIATE_DAKA = process.env.IMMEDIATE_DAKA
  ? process.env.IMMEDIATE_DAKA !== '0'
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
const TIMEZONE_MINUTE_OFFSET = Number.isNaN(
  Number(process.env.TIMEZONE_MINUTE_OFFSET)
)
  ? 480
  : +process.env.TIMEZONE_MINUTE_OFFSET;

module.exports = {
  MODULE,
  USERNAME,
  PASSWORD,
  MODULE_OPTIONS,
  IMMEDIATE_DAKA,
  DELAY_START_MINS,
  DELAY_END_MINS,
  MAX_RETRY_COUNT,
  TIMEZONE_MINUTE_OFFSET,
};
