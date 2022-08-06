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
- Enter your username and password
- Change the DELAY_MIN_MINS or DELAY_MAX_MINS if you want to change the delay time
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
    - cron: '30 1 * * *'
    - cron: '0 11 * * *'
```

- Add secrets to Github Actions
  - FEMAS_USERNAME: your username for FEMAS
  - FEMAS_PASSWORD: your password for FEMAS
  - DELAY_MIN_MINS: the minimum delay minutes (default: 1) (optional)
  - DELAY_MAX_MINS: the maximum delay minutes (default: 15) (optional)

### Docker

- Pull the image from my Docker Hub or build your own docker image

```bash
$ docker pull jyunhanlin/daka:latest
```

- Run the image with your username and password

```bash
$ docker run -e FEMAS_USERNAME USERNAME -e FEMAS_PASSWORD PASSWORD DAKA_IMAGE
```
