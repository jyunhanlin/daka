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
    this.dakaModule.logout();
  }

  checkDakaDay() {
    return this.dakaModule.checkDakaDay();
  }

  async punch() {
    try {
      await this.login();

      const isDakaDay = await this.checkDakaDay();

      if (isDakaDay) this.dakaModule.punch({ punchType });
    } catch (e) {}

    this.logout();
  }
}

module.exports = Daka;
