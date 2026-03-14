const { sleep } = require('./utils/resource');

class Daka {
  constructor({ dakaModule, username, password, maxRetryCount, punchType }) {
    this.dakaModule = dakaModule;
    this.username = username;
    this.password = password;
    this.retryCount = 0;
    this.maxRetryCount = maxRetryCount;
    this.punchType = punchType;
  }

  punch = async () => {
    try {
      await this.dakaModule.login({
        username: this.username,
        password: this.password,
      });

      const isDakaDay = await this.dakaModule.checkDakaDay({
        punchType: this.punchType,
      });

      if (isDakaDay) await this.dakaModule.punch({ punchType: this.punchType });
    } catch (e) {
      console.log('Error:', e);

      if (this.retryCount < this.maxRetryCount) {
        console.log('Some error happen, retry in 3 secs');
        this.retryCount += 1;

        await sleep(3000);
        await this.punch();
      }
    }

    await this.dakaModule.logout();
  };
}

module.exports = Daka;
