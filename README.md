# Daka

Check the holidays and your personal events, then daka!!

## Overview

Daka automatically manages your attendance tracking by punching in and out at scheduled times. It accounts for holidays and personal events, and offers flexible deployment options via Crontab, GitHub Actions, or Docker.

## Features

- Automated punch-in/punch-out at configurable times
- Support for multiple modules (mayo, femas)
- Configurable delay times to simulate natural check-in/check-out patterns
- Retry mechanism for failed attempts
- Multiple deployment options

## Installation

```bash
git clone https://github.com/jyunhanlin/daka.git
cd daka
npm install
```

## Configuration

Copy the example environment file:

```bash
cp example.env .env
```

### Required Environment Variables

| Variable | Description                 |
| -------- | --------------------------- |
| MODULE   | Daka module (mayo \| femas) |
| USERNAME | Your account username       |
| PASSWORD | Your account password       |

### Optional Environment Variables

| Variable         |  Default  | Description                                                       |
| ---------------- | :-------: | ----------------------------------------------------------------- |
| MODULE_OPTIONS   | undefined | Module-specific configuration options                             |
| DELAY_START_MINS |     5     | Random delay minutes before punching (0 to DELAY_START_MINS)      |
| DELAY_END_MINS   |    15     | Maximum delay minutes (range: DELAY_START_MINS to DELAY_END_MINS) |
| IMMEDIATE_DAKA   |     0     | Enable immediate check-in without delay (1: enable, 0: disable)   |
| MAX_RETRY_COUNT  |     3     | Maximum number of retry attempts                                  |

## Deployment Options

### Crontab

Set up scheduled jobs using crontab:

```bash
crontab -e

# Add these lines (replace paths with your actual paths):
# Check-in at 10:00 AM
0 10 * * * /path/to/node /path/to/daka/src/index.js S >> /path/to/logs/daka.log 2>&1
# Check-out at 7:00 PM
0 19 * * * /path/to/node /path/to/daka/src/index.js E >> /path/to/logs/daka.log 2>&1
```

### GitHub Actions

> **Note**: [GitHub Actions scheduled events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) may experience slight delays.

Update the schedule of workflow file at `.github/workflows/daka.yml`:

```yaml
name: Daka

on:
  schedule:
    # UTC times (adjust as needed)
    - cron: '30 0 * * *' # Check-in
    - cron: '0 11 * * *' # Check-out

jobs:
  daka: ...
```

Add your secrets (MODULE, USERNAME, PASSWORD) in your GitHub repository settings.

### Docker

Pull the pre-built image:

```bash
# From Docker Hub
docker pull jyunhanlin/daka:latest

# Or from GitHub Packages
docker pull ghcr.io/jyunhanlin/daka:latest
```

Or build your own:

```bash
docker build -t daka .
```

Run the container:

```bash
docker run -e MODULE=module -e USERNAME=your_username -e PASSWORD=your_password jyunhanlin/daka:latest
```

For scheduled execution, consider using a cron job to run the Docker container.

## Usage

### Manual Execution

To manually trigger a check-in or check-out:

```bash
# Check-in (S parameter)
node src/index.js S

# Check-out (E parameter)
node src/index.js E
```

Without specifying a parameter, Daka determines punch type based on the time of day (before/after noon).

## License

[MIT](LICENSE)
