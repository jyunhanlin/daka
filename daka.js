require("dotenv").config();
require("cross-fetch/polyfill");

const {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMinutes,
} = require("date-fns");

const DOMAIN = process.env.FEMAS_DOMAIN;
const USER_NAME = process.env.FEMAS_USERNAME;
const USER_PASSWORD = process.env.FEMAS_PASSWORD;
const DELAY_START_MINS = process.env.DELAY_START_MINS || 5;
const DELAY_END_MINS = process.env.DELAY_END_MINS || 15;
const IMMEDIATE_DAKA = process.env.IMMEDIATE_DAKA || false;
const MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;

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
  return date.toISOString().split("T")[0];
};

const UTC_TODAY = new Date();
const TODAY = getCSTDate(UTC_TODAY);
const HOUR = TODAY.getUTCHours();

const getSession = async () => {
  let session = "";
  const getCookieResponse = await fetch(`https://femascloud.com/${DOMAIN}/`);

  const sessions = getCookieResponse.headers
    .get("set-cookie")
    .split(";")
    .filter((cookie) => cookie.includes("swag="))
    .map((cookie) => cookie.replace(/.*swag=/, ""));

  // use last one cookie
  session = sessions.length ? sessions[sessions.length - 1] : session;

  return { session };
};

const login = async ({ session }) => {
  const loginData = new URLSearchParams();

  loginData.append("data[Account][username]", USER_NAME);
  loginData.append("data[Account][passwd]", USER_PASSWORD);
  loginData.append("data[remember]", 0);

  const postLoginResponse = await fetch(
    `https://femascloud.com/${DOMAIN}/Accounts/login`,
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${DOMAIN}=${session}`,
      },
      body: loginData,
      method: "POST",
    }
  );

  const html = await postLoginResponse.text();

  const cherrio = require("cheerio");
  const $ = cherrio.load(html);

  const ClockRecordUserId = $("#ClockRecordUserId").val();
  const AttRecordUserId = $("#AttRecordUserId").val();

  if (ClockRecordUserId && AttRecordUserId) console.log("login success");
  else {
    console.log({ html });
    throw new Error("login maybe error, did not get the id");
  }

  return { ClockRecordUserId, AttRecordUserId };
};

const checkDakaDay = async ({ session }) => {
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
      `https://femascloud.com/${DOMAIN}/Holidays/get_holidays?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${DOMAIN}=${session};  lifeTimePoint${DOMAIN}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${DOMAIN}/Holidays/browse`,
        },
        method: "GET",
      }
    ),
    fetch(
      `https://femascloud.com/${DOMAIN}/Holidays/get_events?start=${startDayOfMonth}&end=${lastDayOfMonth}&_=${Date.now()}`,
      {
        headers: {
          cookie: `${DOMAIN}=${session};  lifeTimePoint${DOMAIN}=${SESSION_LIFE_TIME}`,
          Referer: `https://femascloud.com/${DOMAIN}/Holidays/browse`,
        },
        method: "GET",
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
      const start = cur.origStart.split(" ")[0];
      const end = cur.origEnd.split(" ")[0];

      return [...acc, ...getDaysArray(start, end)];
    }, []),
  ];

  const shouldDakaToday = !shouldNotDakaDays.includes(dakaDay);

  console.log(dakaDay, shouldDakaToday ? "daka" : "not daka");

  return shouldDakaToday;
};

const daka = async ({ session, ClockRecordUserId, AttRecordUserId }) => {
  const dakaData = new URLSearchParams();

  const clockType = HOUR >= 12 ? "E" : "S";
  console.log(clockType === "E" ? "bye" : "gogo");

  dakaData.append("_method", "POST");
  dakaData.append("data[ClockRecord][user_id]", ClockRecordUserId);
  dakaData.append("data[AttRecord][user_id]", AttRecordUserId);
  dakaData.append("data[ClockRecord][shift_id]", "2");
  dakaData.append("data[ClockRecord][period]", "1");
  dakaData.append("data[ClockRecord][clock_type]", clockType);
  dakaData.append("data[ClockRecord][latitude]", "");
  dakaData.append("data[ClockRecord][longitude]", "");

  const dakaResponse = await fetch(
    `https://femascloud.com/${DOMAIN}/users/clock_listing`,
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        cookie: `${DOMAIN}=${session};  lifeTimePoint${DOMAIN}=${SESSION_LIFE_TIME}`,
        Referer: `https://femascloud.com/${DOMAIN}/users/main?from=/Accounts/login?ext=html`,
      },
      body: dakaData,
      method: "POST",
    }
  );

  const html = await dakaResponse.text();

  const cherrio = require("cheerio");
  const $ = cherrio.load(html);

  const dakaRecords = $(".textBlue");

  let dakaTime;
  if (clockType !== "E") dakaTime = dakaRecords.eq(0).text().trim();
  else dakaTime = dakaRecords.eq(1).text().trim();

  if (!dakaTime) {
    throw new Error("daka error");
  }

  console.log(`daka success, time: ${dakaTime}`);
};

const logout = ({ session }) => {
  fetch(`https://femascloud.com/${DOMAIN}/accounts/logout`, {
    headers: {
      cookie: `${DOMAIN}=${session};  lifeTimePoint${DOMAIN}=${SESSION_LIFE_TIME}`,
      Referer: `https://femascloud.com/${DOMAIN}/users/main?from=/Accounts/login?ext=html`,
    },
    method: "GET",
  });
};

const getRandomMinute = (min, max) => {
  const minMinute = min * 60;
  const maxMinute = max * 60;
  return Math.floor(Math.random() * (maxMinute - minMinute + 1)) + minMinute;
};

const delay = () => {
  const delay =
    HOUR >= 12
      ? getRandomMinute(DELAY_START_MINS, DELAY_END_MINS)
      : getRandomMinute(0, DELAY_START_MINS);

  console.log(`daka delay ${delay / 60} mins`);

  return new Promise((resolve) => {
    setTimeout(resolve, delay * 1000);
  });
};

let retryCount = 0;
const main = async () => {
  console.log("===== start =====");

  if (!IMMEDIATE_DAKA && !retryCount) await delay();

  let session = "";
  try {
    getSessionResponse = await getSession();
    session = getSessionResponse.session;

    const { ClockRecordUserId, AttRecordUserId } = await login({ session });

    const isDakaDay = await checkDakaDay({ session });

    if (isDakaDay) {
      await daka({ session, ClockRecordUserId, AttRecordUserId });
    }
    retryCount = 0;
  } catch (e) {
    console.log("Error:", e);

    if (retryCount < MAX_RETRY_COUNT) {
      console.log("Some error happen, retry in 3 secs");
      retryCount += 1;
      await logout({ session });
      setTimeout(main, 3000);
    }
  }
  logout({ session });
  console.log("===== end =====");
};

main();
