# Daka

Check the holidays, and your personal events, then daka!!

## Usage

Use `Crontab`, `Github Actions`, or `Docker` to run the schedule.

### Crontab

- Install

```bash
npm install
```

- Copy `example.env` to `.env`
- Change the env
  - FEMAS_DOMAIN: the company domain for FEMAS
  - FEMAS_USERNAME: your username for FEMAS
  - FEMAS_PASSWORD: your password for FEMAS
- Edit the `crontab`

```bash
crontab -e

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

### Docker

- Pull the image from my Docker Hub or build your own docker image

```bash
docker pull jyunhanlin/daka:latest

# or

docker build -t daka .
```

- Run the image with username and password

```bash
docker run -e FEMAS_DOMAIN=DOMAIN -e FEMAS_USERNAME=USERNAME -e FEMAS_PASSWORD=PASSWORD DAKA_IMAGE
```

### Other environment variables

- DELAY_START_MINS: the delay mins before start daka, range from 0 to DELAY_START_MINS (default: 5)
- DELAY_END_MINS: the delay mins before end daka, range from DELAY_START_MINS to DELAY_END_MINS (default: 15)
- IMMEDIATE_DAKA: immediate daka (default: false) (optional)
- MAX_RETRY_COUNT: total retry times (default: 3) (optional)
