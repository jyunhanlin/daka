require('cross-fetch/polyfill');

const {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMinutes,
} = require('date-fns');

const CST_TIMEZONE_OFFSET = -480;
const SESSION_LIFE_TIME = Math.floor(new Date().getTime() / 1000) + 1800; // copy from femas javascript

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

const UTC_TODAY = new Date();
const TODAY = getCSTDate(UTC_TODAY);
const HOUR = TODAY.getUTCHours();

const getSession = async ({ domain }) => {
  let session = '';
  const getCookieResponse = await fetch(`https://femascloud.com/${domain}/`);

  const sessions = getCookieResponse.headers
    .get('set-cookie')
    .split(';')
    .filter((cookie) => cookie.includes('swag='))
    .map((cookie) => cookie.replace(/.*swag=/, ''));

  // use last one cookie
  session = sessions.length ? sessions[sessions.length - 1] : session;

  return { session };
};

const login = async ({ session, domain, username, password }) => {
  const loginData = new URLSearchParams();

  loginData.append('data[Account][username]', username);
  loginData.append('data[Account][passwd]', password);
  loginData.append('data[remember]', 0);

  const postLoginResponse = await fetch(
    `https://femascloud.com/${domain}/Accounts/login`,
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `${domain}=${session}`,
      },
      body: loginData,
      method: 'POST',
    }
  );

  const html = await postLoginResponse.text();

  const cherrio = require('cheerio');
  const $ = cherrio.load(html);

  const ClockRecordUserId = $('#ClockRecordUserId').val();
  const AttRecordUserId = $('#AttRecordUserId').val();

  if (ClockRecordUserId && AttRecordUserId) console.log('login success');
  else {
    console.log({ html });
    throw new Error('login maybe error, did not get the id');
  }

  return { ClockRecordUserId, AttRecordUserId };
};

const checkDakaDay = async ({ session, domain }) => {
  const startDayOfMonth = format(startOfMonth(TODAY));
  const lastDayOfMonth = format(endOfMonth(TODAY));

  const dakaDay = format(TODAY);

  const getDaysArray = (start, end) =>
    eachDayOfInterval({
      start: new Date(start),
      end: new Date(end),
    }).map((day) => format(getCSTDate(day)));

  const [holidaysResponse, personalEventsResponse] = await Promise.all([
    fetch(
      `https://femascloud.com/${domain}/Holidays/get_holidays?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${domain}/Holidays/browse`,
        },
        method: 'GET',
      }
    ),
    fetch(
      `https://femascloud.com/${domain}/Holidays/get_events?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${domain}/Holidays/browse`,
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

const daka = async ({
  session,
  domain,
  ClockRecordUserId,
  AttRecordUserId,
}) => {
  const dakaData = new URLSearchParams();

  const clockType = HOUR >= 12 ? 'E' : 'S';
  console.log(clockType === 'E' ? 'bye' : 'gogo');

  dakaData.append('_method', 'POST');
  dakaData.append('data[ClockRecord][user_id]', ClockRecordUserId);
  dakaData.append('data[AttRecord][user_id]', AttRecordUserId);
  dakaData.append('data[ClockRecord][shift_id]', '2');
  dakaData.append('data[ClockRecord][period]', '1');
  dakaData.append('data[ClockRecord][clock_type]', clockType);
  dakaData.append('data[ClockRecord][latitude]', '');
  dakaData.append('data[ClockRecord][longitude]', '');

  const dakaResponse = await fetch(
    `https://femascloud.com/${domain}/users/clock_listing`,
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
        Referer: `https://femascloud.com/${domain}/users/main?from=/Accounts/login?ext=html`,
      },
      body: dakaData,
      method: 'POST',
    }
  );

  const html = await dakaResponse.text();

  const cherrio = require('cheerio');
  const $ = cherrio.load(html);

  const dakaRecords = $('.textBlue');

  let dakaTime;
  if (clockType !== 'E') dakaTime = dakaRecords.eq(0).text().trim();
  else dakaTime = dakaRecords.eq(1).text().trim();

  if (!dakaTime) {
    throw new Error('daka error');
  }

  console.log(`daka success, time: ${dakaTime}`);
};

const logout = ({ session, domain }) => {
  fetch(`https://femascloud.com/${domain}/accounts/logout`, {
    headers: {
      cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
      Referer: `https://femascloud.com/${domain}/users/main?from=/Accounts/login?ext=html`,
    },
    method: 'GET',
  });
};

module.exports = {
  login,
  logout,
  checkDakaDay,
  daka,
  getSession,
};
