mod media;
mod models;
mod window;

use std::fs;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use media::{collect_managed_media, delete_managed_media_file, managed_media_dir, unique_destination_path};
use models::{ManagedMediaItem, ViewerSettings};
use window::{
    apply_viewer_settings, close_viewer_window, ensure_viewer_window, ensure_windows,
    get_viewer_window_size, list_monitors, open_settings_window, toggle_titlebar, toggle_viewer_mode,
};

#[tauri::command(rename = "open_settings_window")]
fn open_settings_window_cmd(app: AppHandle) {
    open_settings_window(&app);
}

#[tauri::command(rename = "toggle_titlebar")]
fn toggle_titlebar_cmd(app: AppHandle) {
    toggle_titlebar(&app);
}

#[tauri::command(rename = "toggle_viewer_mode")]
fn toggle_viewer_mode_cmd(app: AppHandle) {
    toggle_viewer_mode(&app);
}

#[tauri::command(rename = "get_viewer_window_size")]
fn get_viewer_window_size_cmd(app: AppHandle) -> Option<models::WindowSize> {
    get_viewer_window_size(&app)
}

#[tauri::command(rename = "close_viewer_window")]
fn close_viewer_window_cmd(app: AppHandle) {
    close_viewer_window(&app);
}

#[tauri::command(rename = "ensure_viewer_window")]
fn ensure_viewer_window_cmd(app: AppHandle) -> Result<(), String> {
    ensure_viewer_window(&app)
}

#[tauri::command(rename = "list_monitors")]
fn list_monitors_cmd(app: AppHandle) -> Vec<models::MonitorInfo> {
    list_monitors(&app)
}

#[tauri::command(rename = "apply_viewer_settings")]
fn apply_viewer_settings_cmd(app: AppHandle, settings: ViewerSettings) {
    apply_viewer_settings(&app, settings);
}

#[tauri::command]
async fn pick_and_import_media(app: AppHandle) -> Result<Vec<ManagedMediaItem>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter(
            "Media",
            &[
                "pdf", "png", "jpg", "jpeg", "gif", "webp", "bmp", "mp4", "webm", "mov", "mkv",
            ],
        )
        .pick_file(move |picked| {
            let _ = tx.send(picked.and_then(|p| p.into_path().ok()));
        });

    let picked = rx
        .await
        .map_err(|_| "ファイル選択を受け取れませんでした".to_string())?;
    let Some(source) = picked else {
        return list_managed_media(app);
    };

    let target_dir = managed_media_dir(&app)?;
    let destination = unique_destination_path(&target_dir, &source);
    fs::copy(&source, &destination).map_err(|e| format!("ファイルコピー失敗: {e}"))?;
    Ok(collect_managed_media(&target_dir))
}

#[tauri::command]
fn list_managed_media(app: AppHandle) -> Result<Vec<ManagedMediaItem>, String> {
    let dir = managed_media_dir(&app)?;
    Ok(collect_managed_media(&dir))
}

#[tauri::command]
fn delete_managed_media(app: AppHandle, path: String) -> Result<Vec<ManagedMediaItem>, String> {
    delete_managed_media_file(&app, &path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(ensure_windows)
        .invoke_handler(tauri::generate_handler![
            open_settings_window_cmd,
            toggle_titlebar_cmd,
            toggle_viewer_mode_cmd,
            get_viewer_window_size_cmd,
            close_viewer_window_cmd,
            ensure_viewer_window_cmd,
            list_monitors_cmd,
            apply_viewer_settings_cmd,
            pick_and_import_media,
            list_managed_media,
            delete_managed_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
