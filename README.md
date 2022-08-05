# Daka

Check the holidays, and your personal events, then daka!!

## Install

```bash
$ npm install
```

## Usage

1. Copy `example.env` to `.env`
2. Enter your username and password
3. Change the DELAY_MIN_MINS or DELAY_MAX_MINS if you want to change the delay time

### Crontab

```bash
$ crontab -e
```

```bash
0 10,19 * * * /NODE_PATH/node /DAKA_FOLDER/daka.js >>/LOG_FOLDER/daka.log 2>&1
```

### or use Github Actions

> [Note](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule): The schedule event may be delayed. 

- Change the cron you want (Github Actions use UTC time)

```yaml
on:
  schedule:
    - cron: '30 1 * * *'
    - cron: '0 11 * * *'
```

- Add secrets to Github Actions
  - FEMAS_USERNAME: your username for FEMAS
  - FEMAS_PASSWORD: your password for FEMAS
  - DELAY_MIN_MINS: the minimum delay minutes (default: 1) (optional)
  - DELAY_MAX_MINS: the maximum delay minutes (default: 15) (optional)
