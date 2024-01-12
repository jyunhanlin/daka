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
} = require('./env.js');
const { delay, HOUR } = require('./resource.js');
const Daka = require('./daka.js');
const Module = require(`./libs/${MODULE}.js`);

let punchType = HOUR >= 12 ? 'E' : 'S';

async function main() {
  console.log('===== start =====');

  if (!IMMEDIATE_DAKA)
    await delay({
      punchType,
      delayStartMins: DELAY_START_MINS,
      delayEndMins: DELAY_END_MINS,
    });

  const daka = new Daka({
    dakaModule: new Module({ options: MODULE_OPTIONS }),
    username: USERNAME,
    password: PASSWORD,
    retryCount: MAX_RETRY_COUNT,
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
} else {
  if (process.argv[2] && ['S', 'E'].includes(process.argv[2]))
    punchType = process.argv[2];

  main();
}
