const { startOfMonth, endOfMonth } = require('date-fns');

const {
  getCSTDate,
  format,
  TODAY,
  HOUR,
  MINUTE,
  checkPersonalEvents,
} = require('../resource');

const SESSION_LIFE_TIME = Math.floor(TODAY.getTime() / 1000) + 1800; // copy from femas javascript

class FemasModule {
  constructor({ options }) {
    this.domain = options;
  }

  async _login({ session, domain, username, password }) {
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
  }

  async login() {
    let session = '';
    let ClockRecordUserId = '';
    let AttRecordUserId = '';
    const getCookieResponse = await fetch(
      `https://femascloud.com/${this.domain}/`
    );

    let sessions = [];

    if (getCookieResponse.headers.get('set-cookie')) {
      sessions = getCookieResponse.headers
        .get('set-cookie')
        .split(';')
        .filter((cookie) => cookie.match(/swag=(?!deleted)/))
        .map((cookie) => cookie.replace(/.*swag=/, ''))
        .reverse();
    } else {
      throw new Error('no cookie, try again');
    }

    // dedupe
    sessions = [...new Set(sessions)];

    for (let i = 0; i < sessions.length; i += 1) {
      try {
        const response = await _login({
          session: sessions[i],
          domain: this.domain,
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

    this.session = session;
    this.ClockRecordUserId = ClockRecordUserId;
    this.AttRecordUserId = AttRecordUserId;
  }

  async logout() {
    await fetch(`https://femascloud.com/${this.domain}/accounts/logout`, {
      headers: {
        cookie: `${this.domain}=${this.session};  lifeTimePoint${this.domain}=${SESSION_LIFE_TIME}`,
        Referer: `https://femascloud.com/${this.domain}/users/main?from=/Accounts/login?ext=html`,
      },
      method: 'GET',
    });
  }

  async checkDakaDay() {
    const startDayOfMonth = format(getCSTDate(startOfMonth(TODAY)));
    const lastDayOfMonth = format(getCSTDate(endOfMonth(TODAY)));

    const dakaDay = format(TODAY);

    const holidaysResponse = await fetch(
      `https://femascloud.com/${
        this.domain
      }/Holidays/get_holidays?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${this.domain}=${this.session};  lifeTimePoint${this.domain}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${this.domain}/Holidays/browse`,
        },
        method: 'GET',
      }
    );

    let holidays = (await holidaysResponse.json()) || [];
    holidays = holidays.map((holiday) => holiday.start);

    if (holidays.includes(dakaDay)) {
      console.log(dakaDay, "It's holiday, not daka");
      return false;
    }

    const personalEventsResponse = await fetch(
      `https://femascloud.com/${
        this.domain
      }/Holidays/get_events?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${this.domain}=${this.session};  lifeTimePoint${this.domain}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${this.domain}/Holidays/browse`,
        },
        method: 'GET',
      }
    );

    let personalEvents = (await personalEventsResponse.json()) || [];

    if (
      checkPersonalEvents({
        events: personalEvents,
        today: dakaDay,
        hour: HOUR,
        min: MINUTE,
        punchType,
      })
    ) {
      console.log(dakaDay, "It's a personal event, not daka");
      return false;
    }

    console.log(dakaDay, 'daka');

    return true;
  }

  async punch({ punchType }) {
    console.log(punchType === 'E' ? 'bye' : 'gogo');

    const dakaData = new URLSearchParams();
    dakaData.append('_method', 'POST');
    dakaData.append('data[ClockRecord][user_id]', this.ClockRecordUserId);
    dakaData.append('data[AttRecord][user_id]', this.AttRecordUserId);
    dakaData.append('data[ClockRecord][shift_id]', '2');
    dakaData.append('data[ClockRecord][period]', '1');
    dakaData.append('data[ClockRecord][clock_type]', punchType);
    dakaData.append('data[ClockRecord][latitude]', '');
    dakaData.append('data[ClockRecord][longitude]', '');

    const dakaResponse = await fetch(
      `https://femascloud.com/${this.domain}/users/clock_listing`,
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          cookie: `${this.domain}=${this.session};  lifeTimePoint${this.domain}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${this.domain}/users/main?from=/Accounts/login?ext=html`,
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
    if (punchType !== 'E') dakaTime = dakaRecords.eq(0).text().trim();
    else dakaTime = dakaRecords.eq(1).text().trim();

    if (!dakaTime) {
      throw new Error('daka error');
    }

    console.log(`daka success, time: ${dakaTime}`);
  }

  punch() {}
}

module.exports = FemasModule;
