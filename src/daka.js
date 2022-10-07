require('cross-fetch/polyfill');

const { startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns');

const {
  getCSTDate,
  format,
  SESSION_LIFE_TIME,
  TODAY,
} = require('./resource.js');

const _login = async ({ session, domain, username, password }) => {
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

const login = async ({ domain, username, password }) => {
  let session = '';
  let ClockRecordUserId = '';
  let AttRecordUserId = '';
  const getCookieResponse = await fetch(`https://femascloud.com/${domain}/`);

  let sessions = getCookieResponse.headers
    .get('set-cookie')
    .split(';')
    .filter((cookie) => cookie.match(/swag=(?!deleted)/))
    .map((cookie) => cookie.replace(/.*swag=/, ''))
    .reverse();

  // empty cookie for the last rescue
  sessions.push('');

  // dedupe
  sessions = [...new Set(sessions)];

  for (let i = 0; i < sessions.length; i += 1) {
    try {
      const response = await _login({
        session: sessions[i],
        domain,
        username,
        password,
      });

      if (response.ClockRecordUserId && response.AttRecordUserId) {
        session = sessions[i];
        ClockRecordUserId = response.ClockRecordUserId;
        AttRecordUserId = response.AttRecordUserId;
        break;
      }
    } catch (e) {
      console.log(e);
    }
  }

  if (!ClockRecordUserId || !AttRecordUserId) {
    throw new Error('login error after try all the sessions');
  }

  return {
    session,
    ClockRecordUserId,
    AttRecordUserId,
  };
};

const checkDakaDay = async ({ session, domain }) => {
  const startDayOfMonth = format(getCSTDate(startOfMonth(TODAY)));
  const lastDayOfMonth = format(getCSTDate(endOfMonth(TODAY)));

  const dakaDay = format(TODAY);

  const getDaysArray = (start, end) =>
    eachDayOfInterval({
      start: new Date(start),
      end: new Date(end),
    }).map((day) => format(getCSTDate(day)));

  const holidaysResponse = await fetch(
    `https://femascloud.com/${domain}/Holidays/get_holidays?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
    {
      headers: {
        cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
        Referer: `https://femascloud.com/${domain}/Holidays/browse`,
      },
      method: 'GET',
    }
  );

  let holidays = await holidaysResponse.json();
  holidays = holidays.map((holiday) => holiday.start);

  if (holidays.includes(dakaDay)) {
    console.log(dakaDay, "It's holiday, not daka");
    return false;
  }

  const personalEventsResponse = await fetch(
    `https://femascloud.com/${domain}/Holidays/get_events?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
    {
      headers: {
        cookie: `${domain}=${session};  lifeTimePoint${domain}=${SESSION_LIFE_TIME}`,
        Referer: `https://femascloud.com/${domain}/Holidays/browse`,
      },
      method: 'GET',
    }
  );

  let personalEvents = (await personalEventsResponse.json()) || [];
  personalEvents = personalEvents.reduce((acc, cur) => {
    const start = cur.origStart.split(' ')[0];
    const end = cur.origEnd.split(' ')[0];

    return [...acc, ...getDaysArray(start, end)];
  }, []);

  if (personalEvents.includes(dakaDay)) {
    console.log(dakaDay, "It's day off, not daka");
    return false;
  }

  console.log(dakaDay, 'daka');

  return true;
};

const daka = async ({
  clockType,
  session,
  domain,
  ClockRecordUserId,
  AttRecordUserId,
}) => {
  console.log(clockType === 'E' ? 'bye' : 'gogo');

  const dakaData = new URLSearchParams();
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
};
