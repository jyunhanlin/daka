require('dotenv').config();
require('cross-fetch/polyfill');
const cherrio = require('cheerio');
const { format, startOfMonth, endOfMonth, eachDayOfInterval, subMinutes } = require('date-fns');

const USER_NAME = process.env.USER_NAME;
const USER_PASSWORD = process.env.USER_PASSWORD;
const DELAY_MIN_MINUTE = process.env.DELAY_MIN_MINUTE || 1;
const DELAY_MAX_MINUTE = process.env.DELAY_MAX_MINUTE || 15;

const MAGIC_NUMBER = 5;

const SESSION_LIFE_TIME = Math.floor(new Date().getTime() / 1000) + 1800; // copy from femas javascript
const TODAY = new Date();
const TODAY_WITH_TIMEZONE = subMinutes(TODAY, TODAY.getTimezoneOffset());

const login = async () => {
  const getCookieResponse = await fetch('https://femascloud.com/swag/');

  const session = `${getCookieResponse.headers['set-cookie']}`.split(';')[0].split('=')[1];

  const loginData = new URLSearchParams();

  loginData.append('data[Account][username]', USER_NAME);
  loginData.append('data[Account][passwd]', USER_PASSWORD);
  loginData.append('data[remember]', 0);

  const postLoginResponse = await fetch('https://femascloud.com/swag/Accounts/login', {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `swag=${session}`,
    },
    body: loginData,
    method: 'POST',
  });

  const html = await postLoginResponse.text();

  const $ = cherrio.load(html);

  const ClockRecordUserId = $('#ClockRecordUserId').val();
  const AttRecordUserId = $('#AttRecordUserId').val();

  return { session, ClockRecordUserId, AttRecordUserId };
};

const daka = async ({ session, ClockRecordUserId, AttRecordUserId }) => {
  const dakaData = new URLSearchParams();

  const clockType = TODAY.getHours() >= 12 ? 'E' : 'S';
  console.log(clockType === 'E' ? 'bye' : 'gogo');

  dakaData.append('_method', 'POST');
  dakaData.append('data[ClockRecord][user_id]', ClockRecordUserId);
  dakaData.append('data[AttRecord][user_id]', AttRecordUserId);
  dakaData.append('data[ClockRecord][shift_id]', '2');
  dakaData.append('data[ClockRecord][period]', '1');
  dakaData.append('data[ClockRecord][clock_type]', clockType);
  dakaData.append('data[ClockRecord][latitude]', '');
  dakaData.append('data[ClockRecord][longitude]', '');

  await fetch('https://femascloud.com/swag/users/clock_listing', {
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      cookie: `swag=${session};  lifeTimePointswag=${SESSION_LIFE_TIME}`,
      Referer: 'https://femascloud.com/swag/users/main?from=/Accounts/login?ext=html',
    },

    body: dakaData,
    method: 'POST',
  });
};

const checkDakaDay = async ({ session }) => {
  const startDayOfMonth = format(startOfMonth(TODAY_WITH_TIMEZONE), 'yyyy-MM-dd');
  const lastDayOfMonth = format(endOfMonth(TODAY_WITH_TIMEZONE), 'yyyy-MM-dd');

  const dakaDay = format(TODAY, 'yyyy-MM-dd');

  const getDaysArray = (start, end) =>
    eachDayOfInterval({
      start: new Date(start),
      end: new Date(end),
    }).map((day) => format(day, 'yyyy-MM-dd'));

  const [holidaysResponse, personalEventsResponse] = await Promise.all([
    fetch(
      `https://femascloud.com/swag/Holidays/get_holidays?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `swag=${session};  lifeTimePointswag=${SESSION_LIFE_TIME}`,
          Referer: 'https://femascloud.com/swag/Holidays/browse',
        },
        method: 'GET',
      }
    ),
    fetch(
      `https://femascloud.com/swag/Holidays/get_events?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `swag=${session};  lifeTimePointswag=${SESSION_LIFE_TIME}`,
          Referer: 'https://femascloud.com/swag/Holidays/browse',
        },
        method: 'GET',
      }
    ),
  ]);

  const [holidays, personalEvents] = await Promise.all([
    holidaysResponse.json(),
    personalEventsResponse.json(),
  ]);

  const shouldNotDakaDays = [
    ...holidays.map((holiday) => holiday.start),
    ...personalEvents.reduce((acc, cur) => {
      const start = cur.origStart.split(' ')[0];
      const end = cur.origEnd.split(' ')[0];

      return [...acc, ...getDaysArray(start, end)];
    }, []),
  ];

  const shouldDakaToday = !shouldNotDakaDays.includes(dakaDay);

  console.log(dakaDay, shouldDakaToday ? 'daka' : 'not daka');

  return shouldDakaToday;
};

const main = async () => {
  console.log('===== start =====');
  const { session, ClockRecordUserId, AttRecordUserId } = await login();

  const isDakaDay = await checkDakaDay({ session });

  if (isDakaDay) {
    await daka({ session, ClockRecordUserId, AttRecordUserId });
  }
  console.log('===== end =====');
};

const getRandomMinute = (min, max) => {
  const minMinute = min * 60;
  const maxMinute = max * 60;
  return Math.floor(Math.random() * (maxMinute - minMinute + 1)) + minMinute;
};

const randomMinute = getRandomMinute(DELAY_MIN_MINUTE, DELAY_MAX_MINUTE);

const delay =
  TODAY.getHours() >= 12
    ? Math.max(randomMinute, (DELAY_MAX_MINUTE / MAGIC_NUMBER) * 60)
    : randomMinute / MAGIC_NUMBER;

console.log(`daka delay ${delay / 60} mins`);
setTimeout(main, delay * 1000);
