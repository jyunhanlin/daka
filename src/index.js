require('dotenv').config();

const { logout, login, checkDakaDay, daka } = require('./daka.js');
const {
  DOMAIN,
  USER_NAME,
  USER_PASSWORD,
  IMMEDIATE_DAKA,
  MAX_RETRY_COUNT,
} = require('./env.js');
const { delay, HOUR } = require('./resource.js');

let clockType = HOUR >= 12 ? 'E' : 'S'; // default clockType
let retryCount = 0;

const main = async () => {
  console.log('===== start =====');

  if (!IMMEDIATE_DAKA && !retryCount) await delay({ clockType });

  let session;

  try {
    const {
      session: sessionFromLogin,
      ClockRecordUserId,
      AttRecordUserId,
    } = await login({
      domain: DOMAIN,
      username: USER_NAME,
      password: USER_PASSWORD,
    });

    session = sessionFromLogin;

    const isDakaDay = await checkDakaDay({
      clockType,
      session,
      domain: DOMAIN,
    });

    if (isDakaDay) {
      await daka({
        clockType,
        session,
        domain: DOMAIN,
        ClockRecordUserId,
        AttRecordUserId,
      });
    }
    retryCount = 0;
  } catch (e) {
    console.log('Error:', e);

    if (retryCount < MAX_RETRY_COUNT) {
      console.log('Some error happen, retry in 3 secs');
      retryCount += 1;
      setTimeout(main, 3000);
    }
  }
  if (session) logout({ session, domain: DOMAIN });
  console.log('===== end =====');
};

if (!DOMAIN || !USER_NAME || !USER_PASSWORD) {
  console.log('Please set the required env variables');
  process.exit(1);
} else {
  if (process.argv[2] && ['S', 'E'].includes(process.argv[2]))
    clockType = process.argv[2];
  main();
}
