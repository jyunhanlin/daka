const { parseCookies } = require('../resource');

class MayoModule {
  async login({ username, password }) {
    let cookie = '';
    const res1 = await fetch('https://apolloxe.mayohr.com/tube');
    cookie = `${cookie}${parseCookies(res1.headers.getSetCookie())}`;

    const res2 = await fetch('https://auth.mayohr.com/HRM/Account/Login');

    cookie = `${cookie}${parseCookies(res2.headers.getSetCookie())}`;

    const html = await res2.text();

    const cherrio = require('cheerio');
    const $ = cherrio.load(html);
    const __RequestVerificationToken = $(
      '[name=__RequestVerificationToken]'
    ).attr('value');

    const body = new URLSearchParams();
    body.append('__RequestVerificationToken', __RequestVerificationToken);
    body.append('grant_type', 'password');
    body.append('password', password);
    body.append('userName', username);
    body.append('userStatus', 1);

    const res3 = await fetch('https://auth.mayohr.com/Token', {
      method: 'POST',
      cookie,
      body,
    });

    cookie = `${cookie}${parseCookies(res3.headers.getSetCookie())}`;

    const json = await res3.json();

    console.log({ json }, cookie.split(';'));

    const res4 = await fetch(
      `https://authcommon.mayohr.com/api/auth/checkticket?code=${json.code}`,
      {
        method: 'GET',
        headers: {
          cookie,
        },
      }
    );

    this.cookie = parseCookies(res4.headers.getSetCookie());

    console.log(await res4.json());
  }

  logout() {}

  async checkDakaDay() {
    console.log('---->', this.cookie);

    const res = await fetch(
      'https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year=2024&month=1',
      {
        method: 'GET',
        headers: {
          cookie: this.cookie,
        },
      }
    );

    const json = await res.json();

    console.log({ json });
  }

  punch({ punchType }) {}
}

module.exports = MayoModule;
