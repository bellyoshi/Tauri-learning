mod media;
mod models;
mod window;

use std::fs;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use media::{collect_managed_media, delete_managed_media_file, managed_media_dir, unique_destination_path};
use models::{ImportMediaResult, ManagedMediaItem, ViewerSettings};
use window::ensure_windows;

#[tauri::command]
fn open_settings_window(app: AppHandle) -> Result<(), String> {
    window::open_settings_window(&app)
}

#[tauri::command]
fn toggle_titlebar(app: AppHandle) {
    window::toggle_titlebar(&app);
}

#[tauri::command]
fn toggle_viewer_mode(app: AppHandle) {
    window::toggle_viewer_mode(&app);
}

#[tauri::command]
fn get_viewer_window_size(app: AppHandle) -> Option<models::WindowSize> {
    window::get_viewer_window_size(&app)
}

#[tauri::command]
fn close_viewer_window(app: AppHandle) {
    window::close_viewer_window(&app);
}

#[tauri::command]
fn ensure_viewer_window(app: AppHandle) -> Result<(), String> {
    window::ensure_viewer_window(&app)
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<models::MonitorInfo> {
    window::list_monitors(&app)
}

#[tauri::command]
fn apply_viewer_settings(app: AppHandle, settings: ViewerSettings) {
    window::apply_viewer_settings(&app, settings);
}

#[tauri::command]
async fn pick_and_import_media(app: AppHandle) -> Result<Option<ImportMediaResult>, String> {
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
        return Ok(None);
    };

    let target_dir = managed_media_dir(&app)?;
    let destination = unique_destination_path(&target_dir, &source);
    fs::copy(&source, &destination).map_err(|e| format!("ファイルコピー失敗: {e}"))?;
    let imported = ManagedMediaItem {
        name: destination
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "imported".to_string()),
        path: destination.to_string_lossy().to_string(),
    };
    Ok(Some(ImportMediaResult {
        items: collect_managed_media(&target_dir),
        imported,
    }))
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
            open_settings_window,
            toggle_titlebar,
            toggle_viewer_mode,
            get_viewer_window_size,
            close_viewer_window,
            ensure_viewer_window,
            list_monitors,
            apply_viewer_settings,
            pick_and_import_media,
            list_managed_media,
            delete_managed_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
