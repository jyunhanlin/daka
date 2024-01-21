require('dotenv').config();

const {
  MODULE,
  MODULE_OPTIONS,
  USERNAME,
  PASSWORD,
  IMMEDIATE_DAKA,
  MAX_RETRY_COUNT,
  DELAY_START_MINS,
  DELAY_END_MINS,
} = require('./env');
const { delay, HOUR } = require('./utils/resource');
const Daka = require('./daka');

let punchType = HOUR >= 12 ? 'E' : 'S';

async function main() {
  console.log('===== start =====');

  if (!IMMEDIATE_DAKA)
    await delay({
      punchType,
      delayStartMins: DELAY_START_MINS,
      delayEndMins: DELAY_END_MINS,
    });

  const Module = require(`./libs/${MODULE}`);
  const daka = new Daka({
    dakaModule: new Module({ options: MODULE_OPTIONS }),
    username: USERNAME,
    password: PASSWORD,
    maxRetryCount: MAX_RETRY_COUNT,
    punchType,
  });

  await daka.punch();

  console.log('===== end =====');
}

if (!MODULE || !USERNAME || !PASSWORD) {
  console.log(
    'Please set the required env variables, MODULE, USERNAME, PASSWORD'
  );
  process.exit(1);
}

if (process.argv[2] && ['S', 'E'].includes(process.argv[2]))
  punchType = process.argv[2];

main();
