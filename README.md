# Daka

Check the holidays and your personal events, then daka!!

## Overview

Daka automatically manages your attendance tracking by punching in and out at scheduled times. It accounts for holidays and personal events, and offers flexible deployment options.

## Two Ways to Run

### Desktop App (Recommended)

A macOS menu bar app built with Tauri + Rust. No external scheduling needed — runs locally with a built-in scheduler.

- Menu bar icon with status display
- Settings UI for credentials and schedule
- macOS native notifications
- Auto-start on login
- Manual punch as fallback

### CLI

The original Node.js CLI, deployable via Crontab, GitHub Actions, or Docker.

## Features

- Automated punch-in/punch-out at configurable times
- Support for multiple modules (Mayo, Femas)
- Configurable random delay to simulate natural check-in/check-out patterns
- Retry mechanism for failed attempts
- Holiday and personal event detection

## Desktop App

### Install

Download the latest `.dmg` from [Releases](https://github.com/jyunhanlin/daka/releases), open it, and drag Daka to Applications.

First launch (unsigned app):
```bash
xattr -cr /Applications/Daka.app
```

On first run, the settings window opens automatically. Configure your module, credentials, and schedule, then save. Restart the app to apply.

### Build from Source

```bash
cd app/src-tauri
cargo tauri build
```

The `.dmg` will be at `target/release/bundle/dmg/`.

Requires: [Rust](https://rustup.rs/) and [Tauri CLI](https://tauri.app/) (`cargo install tauri-cli`).

## CLI

### Installation

```bash
git clone https://github.com/jyunhanlin/daka.git
cd daka/cli
npm install
```

### Configuration

```bash
cp example.env .env
```

#### Required Environment Variables

| Variable | Description                 |
| -------- | --------------------------- |
| MODULE   | Daka module (mayo \| femas) |
| USERNAME | Your account username       |
| PASSWORD | Your account password       |

#### Optional Environment Variables

| Variable         |  Default  | Description                                                       |
| ---------------- | :-------: | ----------------------------------------------------------------- |
| MODULE_OPTIONS   | undefined | Module-specific configuration options                             |
| DELAY_START_MINS |     5     | Random delay minutes before punching (0 to DELAY_START_MINS)      |
| DELAY_END_MINS   |    15     | Maximum delay minutes (range: DELAY_START_MINS to DELAY_END_MINS) |
| IMMEDIATE_DAKA   |     0     | Enable immediate check-in without delay (1: enable, 0: disable)   |
| MAX_RETRY_COUNT  |     3     | Maximum number of retry attempts                                  |

### Deployment Options

#### Crontab

```bash
crontab -e

# Check-in at 10:00 AM
0 10 * * * /path/to/node /path/to/daka/cli/src/index.js S >> /path/to/logs/daka.log 2>&1
# Check-out at 7:00 PM
0 19 * * * /path/to/node /path/to/daka/cli/src/index.js E >> /path/to/logs/daka.log 2>&1
```

#### GitHub Actions

> **Note**: [GitHub Actions scheduled events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) may experience slight delays.

Add your secrets (MODULE, USERNAME, PASSWORD) in your GitHub repository settings.

#### Docker

```bash
# From Docker Hub
docker pull jyunhanlin/daka:latest

# Or from GitHub Packages
docker pull ghcr.io/jyunhanlin/daka:latest

# Run
docker run -e MODULE=module -e USERNAME=your_username -e PASSWORD=your_password jyunhanlin/daka:latest
```

#### Manual Execution

```bash
cd cli

# Check-in
node src/index.js S

# Check-out
node src/index.js E
```

Without specifying a parameter, Daka determines punch type based on the time of day (before/after noon).

## License

[MIT](LICENSE)
