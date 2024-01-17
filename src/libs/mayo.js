const {
  checkPersonalEvents,
  parseCookies,
  YEAR,
  MONTH,
  DAY,
  HOUR,
  MINUTE,
  format,
  TODAY,
} = require('../utils/resource');

class MayoModule {
  async login({ username, password }) {
    let cookie = '';

    // get the csrf token
    const res1 = await fetch('https://auth.mayohr.com/HRM/Account/Login');
    cookie = `${cookie}${parseCookies(res1.headers.getSetCookie())}`;
    const html = await res1.text();
    const cherrio = require('cheerio');
    const $ = cherrio.load(html);
    const csrfToken = $('[name=__RequestVerificationToken]').attr('value');

    if (!csrfToken) throw new Error('no csrfToken');

    // login
    const body = new URLSearchParams();
    body.append('__RequestVerificationToken', csrfToken);
    body.append('grant_type', 'password');
    body.append('password', password);
    body.append('userName', username);
    body.append('userStatus', 1);
    const res2 = await fetch('https://auth.mayohr.com/Token', {
      method: 'POST',
      headers: {
        cookie,
      },
      body,
    });
    cookie = `${cookie}${parseCookies(res2.headers.getSetCookie())}`;

    const { code } = await res2on();

    if (!code) throw new Error('no code');

    // get the session cookie
    const res3 = await fetch(
      `https://authcommon.mayohr.com/api/auth/checkticket?code=${code}`,
      {
        method: 'GET',
        headers: {
          cookie,
        },
      }
    );
    cookie = `${cookie}${parseCookies(res3.headers.getSetCookie())}`;

    this.cookie = cookie;
  }

  async logout() {
    // https://auth.mayohr.com/api/accountapi/ExternalADLogout?returnUrl=https%3A%2F%2Fapolloxe.mayohr.com%2Ftube

    await fetch('https://auth.mayohr.com/api/accountapi/Logout', {
      method: 'GET',
      headers: {
        cookie: this.cookie,
      },
    });
  }

  // ItemOptionId
  // CY00001: working day
  // CY00003: recess day or public holiday
  // CY00004: regular day off
  async checkDakaDay({ punchType }) {
    const dakaDay = format(TODAY);

    const res = await fetch(
      `https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year=${YEAR}&month=${MONTH}`,
      {
        method: 'GET',
        headers: {
          cookie: this.cookie,
        },
      }
    );

    const { Data } = await reson();

    if (!Data.Calendars) throw new Error('get calendar failed');

    const calendarIndex = DAY - 1;

    const currentDayCalendar = Data.Calendars[calendarIndex];

    if (!currentDayCalendar) throw new Error('get current day calendar failed');

    if (['CY00003', 'CY00004'].includes(currentDayCalendar.ItemOptionId)) {
      console.log(dakaDay, "It's day off, no daka");
      return false;
    }

    // TODO: personal events
    const personalEvents = currentDayCalendar.LeaveSheets;
    if (
      checkPersonalEvents({
        events: personalEvents,
        today: dakaDay,
        hour: HOUR,
        min: MINUTE,
        punchType,
      })
    ) {
      console.log(dakaDay, "It's a personal event, no daka");
      return false;
    }

    console.log(dakaDay, 'daka');

    return true;
  }

  // AttendanceType:
  // 1: punch in
  // 2: punch out
  async punch({ punchType }) {
    const res = await fetch(
      'https://apolloxe.mayohr.com/backend/pt/api/checkIn/punch/web',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: this.cookie,
        },
        body: JSON.stringify({
          AttendanceType: punchType === 'S' ? 1 : 2,
        }),
      }
    );

    const result = await res.json();

    const { Meta } = result;

    // TODO, wait for mins from result
    if (Meta?.HttpStatusCode !== '200')
      throw new Error(`daka punch failed, ${JSON.stringify(result)}`);
  }
}

module.exports = MayoModule;
