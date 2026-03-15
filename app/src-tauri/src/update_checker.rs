use log::info;
use serde::Deserialize;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

const GITHUB_RELEASE_URL: &str = "https://api.github.com/repos/jyunhanlin/daka/releases/latest";

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
}

pub struct UpdateInfo {
    pub version: String,
    pub url: String,
}

pub async fn check_for_update() -> Option<UpdateInfo> {
    let client = reqwest::Client::new();
    let res = client
        .get(GITHUB_RELEASE_URL)
        .header("User-Agent", "daka-app")
        .send()
        .await
        .ok()?;

    let release: GitHubRelease = res.json().await.ok()?;
    let remote_version = release.tag_name.trim_start_matches('v');

    if is_newer(remote_version, CURRENT_VERSION) {
        info!(
            "Update available: {} -> {}",
            CURRENT_VERSION, remote_version
        );
        Some(UpdateInfo {
            version: release.tag_name,
            url: release.html_url,
        })
    } else {
        info!("App is up to date ({})", CURRENT_VERSION);
        None
    }
}

fn is_newer(remote: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> { v.split('.').filter_map(|s| s.parse().ok()).collect() };
    let remote_parts = parse(remote);
    let current_parts = parse(current);
    remote_parts > current_parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_patch() {
        assert!(is_newer("0.2.0", "0.1.0"));
    }

    #[test]
    fn test_is_newer_same() {
        assert!(!is_newer("0.1.0", "0.1.0"));
    }

    #[test]
    fn test_is_newer_older() {
        assert!(!is_newer("0.0.9", "0.1.0"));
    }

    #[test]
    fn test_is_newer_major() {
        assert!(is_newer("1.0.0", "0.9.9"));
    }
}
