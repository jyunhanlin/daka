# Daka

Check the holidays, and your personal events, then daka!!

## Usage

Use `Crontab`, `Github Actions`, or `Docker` to run the schedule.

### Crontab

- Install

```bash
$ npm install
```

- Copy `example.env` to `.env`
- Change the env
  - FEMAS_DOMAIN: the company domain for FEMAS
  - FEMAS_USERNAME: your username for FEMAS
  - FEMAS_PASSWORD: your password for FEMAS
  - DELAY_MIN_MINS: the minimum delay minutes
  - DELAY_MAX_MINS: the maximum delay minutes
- Edit the `crontab`

```bash
$ crontab -e

0 10,19 * * * /NODE_PATH/node /DAKA_FOLDER/daka.js >>/LOG_FOLDER/daka.log 2>&1
```

### Github Actions

> [Note](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule): The schedule event may be delayed.

- Modify the schedule you want (Github Actions use UTC time)

```yaml
on:
  schedule:
    - cron: '0 0,11 * * *'
```

- Add secrets to Github Actions
  - FEMAS_DOMAIN: the company domain for FEMAS
  - FEMAS_USERNAME: your username for FEMAS
  - FEMAS_PASSWORD: your password for FEMAS
  - DELAY_MIN_MINS: the minimum delay minutes (default: 1) (optional)
  - DELAY_MAX_MINS: the maximum delay minutes (default: 15) (optional)

### Docker

- Pull the image from my Docker Hub or build your own docker image

```bash
$ docker pull jyunhanlin/daka:latest

or

$ docker build -t daka .
```

- Run the image with username and password

```bash
$ docker run -e FEMAS_DOMAIN DOMAIN -e FEMAS_USERNAME USERNAME -e FEMAS_PASSWORD PASSWORD DAKA_IMAGE
# -e DELAY_MIN_MINS 1 -e DELAY_MAX_MINS 15 (optional)
```
