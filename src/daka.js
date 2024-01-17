class Daka {
  constructor({ dakaModule, username, password, retryCount, punchType }) {
    this.dakaModule = dakaModule;
    this.username = username;
    this.password = password;
    this.retryCount = retryCount;
    this.punchType = punchType;
  }

  login() {
    return this.dakaModule.login({
      username: this.username,
      password: this.password,
    });
  }

  logout() {
    return this.dakaModule.logout();
  }

  checkDakaDay() {
    return this.dakaModule.checkDakaDay();
  }

  async punch() {
    try {
      await this.login();

      const isDakaDay = await this.checkDakaDay();

      await this.dakaModule.punch({ punchType: this.punchType });
    } catch (e) {
      console.log('Error:', e);

      if (retryCount < MAX_RETRY_COUNT) {
        console.log('Some error happen, retry in 3 secs');
        retryCount += 1;
        setTimeout(this.punch, 3000);
      }
    }

    await this.logout();
  }
}

module.exports = Daka;
