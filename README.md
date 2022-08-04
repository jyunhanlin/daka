# Daka

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
0 10,19 * * * cd DAKA_FOLDER/daka &&  /NODE_PATH/node daka.js >>daka.log 2>&1
```

### or use Github Actions

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
