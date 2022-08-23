require('dotenv').config();
require('cross-fetch/polyfill');

const { logout, login, checkDakaDay, daka, getSession } = require('./daka.js');
const {
  DOMAIN,
  USER_NAME,
  USER_PASSWORD,
  IMMEDIATE_DAKA,
  MAX_RETRY_COUNT,
} = require('./env.js');
const { delay } = require('./resource.js');

let retryCount = 0;

const main = async () => {
  console.log('===== start =====');

  if (!IMMEDIATE_DAKA && !retryCount) await delay();

  let session = '';

  try {
    getSessionResponse = await getSession({ domain: DOMAIN });
    session = getSessionResponse.session;

    const { ClockRecordUserId, AttRecordUserId } = await login({
      session,
      domain: DOMAIN,
      username: USER_NAME,
      password: USER_PASSWORD,
    });

    const isDakaDay = await checkDakaDay({ session, domain: DOMAIN });

    if (isDakaDay) {
      await daka({
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
      await logout({ session, domain: DOMAIN });
      setTimeout(main, 3000);
    }
  }
  logout({ session, domain: DOMAIN });
  console.log('===== end =====');
};

if (!DOMAIN || !USER_NAME || !USER_PASSWORD) {
  console.log('Please set the required env variables');
  process.exit(1);
} else main();
