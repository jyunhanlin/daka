class MayoModule {
  async login({ username, password }) {
    fetch('https://apolloxe.mayohr.com/tube').then((res) => {
      console.log('11', res.headers.getSetCookie());
    });

    const res = await fetch('https://auth.mayohr.com/HRM/Account/Login');

    console.log('1.', res.headers.getSetCookie());

    const html = await res.text();

    const cherrio = require('cheerio');
    const $ = cherrio.load(html);
    const __RequestVerificationToken = $(
      '[name=__RequestVerificationToken]'
    ).attr('value');

    console.log('__RequestVerificationToken', __RequestVerificationToken);
    const body = new URLSearchParams();
    body.append('__RequestVerificationToken', __RequestVerificationToken);
    body.append('grant_type', 'password');
    body.append('password', password);
    body.append('userName', username);
    body.append('userStatus', 1);

    const resp = await fetch('https://auth.mayohr.com/Token', {
      method: 'POST',
      body,
    });

    const cookie = resp.headers.getSetCookie();

    console.log('2.', resp.headers.getSetCookie());

    // resp.headers.forEach((value, key) => console.log(key, value));

    const json = await resp.json();

    console.log({ json });

    fetch(
      `https://authcommon.mayohr.com/api/auth/checkticket?code=${json.code}`,
      {
        method: 'GET',
        headers: {
          Cookie: cookie.toString(),
        },
      }
    )
      .then((res) => res.json())
      .then(console.log);
  }

  logout() {}

  async checkDakaDay() {
    const res = await fetch(
      'https://apolloxe.mayohr.com/backend/pt/api/EmployeeCalendars/scheduling/V2?year=2024&month=1',
      {
        headers: {
          accept: '*/*',
          'accept-language': 'zh-tw',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          pragma: 'no-cache',
          'sec-ch-ua':
            '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
        },
        referrer: 'https://apolloxe.mayohr.com/ta/personal/shiftschedule',
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: null,
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
      }
    );

    const json = await res.json();

    // console.log(json);
  }

  punch({ punchType }) {}
}

module.exports = MayoModule;
