use serde::{Deserialize, Serialize};

pub const VIEWER_LABEL: &str = "viewer";
pub const SETTINGS_LABEL: &str = "settings";
pub const CONTROL_LABEL: &str = "control";
pub const MANAGED_MEDIA_DIR: &str = "managed-media";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersistedState {
    pub windows: std::collections::HashMap<String, Bounds>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewerSettings {
    pub background_color: String,
    pub background_image_path: String,
    pub monitor_index: usize,
    pub viewer_mode: ViewerMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewerMode {
    Windowed,
    Fullscreen,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedMediaItem {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportMediaResult {
    pub items: Vec<ManagedMediaItem>,
    pub imported: ManagedMediaItem,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}
