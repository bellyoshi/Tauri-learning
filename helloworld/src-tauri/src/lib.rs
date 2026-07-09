use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use tauri::{
    App, AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;

const VIEWER_LABEL: &str = "viewer";
const SETTINGS_LABEL: &str = "settings";
const CONTROL_LABEL: &str = "control";
const MANAGED_MEDIA_DIR: &str = "managed-media";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PersistedState {
    windows: HashMap<String, Bounds>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewerSettings {
    background_color: String,
    background_image_path: String,
    monitor_index: usize,
    viewer_mode: ViewerMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ViewerMode {
    Windowed,
    Fullscreen,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorInfo {
    index: usize,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedMediaItem {
    name: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowSize {
    width: u32,
    height: u32,
}

fn managed_media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dirの取得に失敗: {e}"))?;
    let dir = base.join(MANAGED_MEDIA_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("managed-mediaフォルダ作成失敗: {e}"))?;
    Ok(dir)
}

fn unique_destination_path(dir: &Path, source: &Path) -> PathBuf {
    let base_name = source
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "imported".to_string());
    let extension = source.extension().map(|e| e.to_string_lossy().to_string());

    let mut candidate = source
        .file_name()
        .map(|n| dir.join(n))
        .unwrap_or_else(|| dir.join(format!("{base_name}.dat")));
    let mut index = 1usize;
    while candidate.exists() {
        let next_name = match &extension {
            Some(ext) => format!("{base_name}_{index}.{ext}"),
            None => format!("{base_name}_{index}"),
        };
        candidate = dir.join(next_name);
        index += 1;
    }
    candidate
}

fn collect_managed_media(dir: &Path) -> Vec<ManagedMediaItem> {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return vec![];
    };
    let mut items = read_dir
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() {
                return None;
            }
            Some(ManagedMediaItem {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
            })
        })
        .collect::<Vec<_>>();
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    if fs::create_dir_all(&dir).is_err() {
        return None;
    }
    Some(dir.join("window-state.json"))
}

fn load_state(app: &AppHandle) -> PersistedState {
    let Some(path) = state_path(app) else {
        return PersistedState::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return PersistedState::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_state(app: &AppHandle, state: &PersistedState) {
    if let Some(path) = state_path(app) {
        let _ = fs::write(path, serde_json::to_string_pretty(state).unwrap_or_default());
    }
}

fn capture_bounds(window: &WebviewWindow) -> Option<Bounds> {
    let pos = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    Some(Bounds {
        x: pos.x as f64,
        y: pos.y as f64,
        width: size.width as f64,
        height: size.height as f64,
    })
}

fn save_window_bounds(window: &WebviewWindow) {
    let Some(bounds) = capture_bounds(window) else {
        return;
    };
    let app = window.app_handle();
    let mut state = load_state(&app);
    state.windows.insert(window.label().to_string(), bounds);
    save_state(&app, &state);
}

fn attach_window_persistence(window: &WebviewWindow) {
    let cloned = window.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
            save_window_bounds(&cloned);
        }
        if matches!(event, WindowEvent::Resized(_)) && cloned.label() == VIEWER_LABEL {
            if let Ok(size) = cloned.inner_size() {
                let _ = cloned.app_handle().emit(
                    "viewer:window-resized",
                    WindowSize {
                        width: size.width,
                        height: size.height,
                    },
                );
            }
        }
    });
}

fn apply_saved_bounds(window: &WebviewWindow, state: &PersistedState) -> bool {
    let Some(bounds) = state.windows.get(window.label()) else {
        return false;
    };
    let _ = window.set_position(PhysicalPosition::new(bounds.x as i32, bounds.y as i32));
    let _ = window.set_size(tauri::Size::Physical(PhysicalSize::new(
        bounds.width.max(200.0) as u32,
        bounds.height.max(200.0) as u32,
    )));
    true
}

fn auto_place_windows(app: &AppHandle) {
    let Some(control) = app.get_webview_window(CONTROL_LABEL) else {
        return;
    };
    let Some(viewer) = app.get_webview_window(VIEWER_LABEL) else {
        return;
    };

    if let Ok(monitors) = control.available_monitors() {
        if monitors.len() >= 2 {
            let primary = monitors.first();
            let secondary = monitors.get(1);
            if let (Some(primary), Some(secondary)) = (primary, secondary) {
                let _ = control.set_position(PhysicalPosition::new(
                    primary.position().x + 20,
                    primary.position().y + 20,
                ));
                let _ = viewer.set_position(PhysicalPosition::new(
                    secondary.position().x + 20,
                    secondary.position().y + 20,
                ));
            }
        } else if let Some(monitor) = monitors.first() {
            let _ = control.set_position(PhysicalPosition::new(
                monitor.position().x + 30,
                monitor.position().y + 30,
            ));
            let _ = viewer.set_position(PhysicalPosition::new(
                monitor.position().x + 360,
                monitor.position().y + 30,
            ));
        }
    }
}

fn ensure_windows(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    if app_handle.get_webview_window(VIEWER_LABEL).is_none() {
        WebviewWindowBuilder::new(&app_handle, VIEWER_LABEL, WebviewUrl::App("index.html".into()))
            .title("Viewer")
            .inner_size(1200.0, 900.0)
            .build()?;
    }

    if app_handle.get_webview_window(SETTINGS_LABEL).is_none() {
        let settings = WebviewWindowBuilder::new(
            &app_handle,
            SETTINGS_LABEL,
            WebviewUrl::App("index.html".into()),
        )
        .title("Settings")
        .inner_size(420.0, 540.0)
        .visible(false)
        .build()?;
        let _ = settings.set_always_on_top(true);
    }

    let state = load_state(&app_handle);

    if let Some(control) = app_handle.get_webview_window(CONTROL_LABEL) {
        attach_window_persistence(&control);
        let _ = apply_saved_bounds(&control, &state);
    }
    if let Some(viewer) = app_handle.get_webview_window(VIEWER_LABEL) {
        attach_window_persistence(&viewer);
        let has_saved = apply_saved_bounds(&viewer, &state);
        if !has_saved {
            auto_place_windows(&app_handle);
        }
    }
    if let Some(settings) = app_handle.get_webview_window(SETTINGS_LABEL) {
        attach_window_persistence(&settings);
        let _ = apply_saved_bounds(&settings, &state);
    }

    Ok(())
}

#[tauri::command]
fn open_settings_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn toggle_titlebar(app: AppHandle) {
    if let Some(win) = app.get_webview_window(VIEWER_LABEL) {
        if let Ok(current) = win.is_decorated() {
            let _ = win.set_decorations(!current);
        }
    }
}

#[tauri::command]
fn toggle_viewer_mode(app: AppHandle) {
    if let Some(win) = app.get_webview_window(VIEWER_LABEL) {
        if let Ok(is_full) = win.is_fullscreen() {
            let next = !is_full;
            let _ = win.set_fullscreen(next);
            let _ = app.emit(
                "viewer:settings-updated",
                serde_json::json!({
                    "viewerMode": if next { "fullscreen" } else { "windowed" }
                }),
            );
        }
    }
}

#[tauri::command]
fn get_viewer_window_size(app: AppHandle) -> Option<WindowSize> {
    let viewer = app.get_webview_window(VIEWER_LABEL)?;
    let size = viewer.inner_size().ok()?;
    Some(WindowSize {
        width: size.width,
        height: size.height,
    })
}

#[tauri::command]
fn close_viewer_window(app: AppHandle) {
    if let Some(viewer) = app.get_webview_window(VIEWER_LABEL) {
        let _ = viewer.close();
    }
}

#[tauri::command]
fn ensure_viewer_window(app: AppHandle) -> Result<(), String> {
    let viewer = if let Some(win) = app.get_webview_window(VIEWER_LABEL) {
        win
    } else {
        let created =
            WebviewWindowBuilder::new(&app, VIEWER_LABEL, WebviewUrl::App("index.html".into()))
                .title("Viewer")
                .inner_size(1200.0, 900.0)
                .build()
                .map_err(|e| format!("Viewerウインドウ作成失敗: {e}"))?;
        attach_window_persistence(&created);
        let state = load_state(&app);
        let has_saved = apply_saved_bounds(&created, &state);
        if !has_saved {
            auto_place_windows(&app);
        }
        created
    };
    let _ = viewer.show();
    let _ = viewer.set_focus();
    Ok(())
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let Some(control) = app.get_webview_window(CONTROL_LABEL) else {
        return vec![];
    };
    let Ok(monitors) = control.available_monitors() else {
        return vec![];
    };
    monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| MonitorInfo {
            index,
            name: monitor
                .name()
                .map(|n| format!("{} ({})", n, index + 1))
                .unwrap_or_else(|| format!("Monitor {}", index + 1)),
        })
        .collect()
}

fn move_viewer_to_monitor(app: &AppHandle, monitor_index: usize) {
    let Some(viewer) = app.get_webview_window(VIEWER_LABEL) else {
        return;
    };
    let Some(control) = app.get_webview_window(CONTROL_LABEL) else {
        return;
    };
    let Ok(monitors) = control.available_monitors() else {
        return;
    };
    let Some(monitor) = monitors.get(monitor_index) else {
        return;
    };
    let _ = viewer.set_position(PhysicalPosition::new(
        monitor.position().x + 20,
        monitor.position().y + 20,
    ));
}

#[tauri::command]
fn apply_viewer_settings(app: AppHandle, settings: ViewerSettings) {
    if let Some(viewer) = app.get_webview_window(VIEWER_LABEL) {
        match settings.viewer_mode {
            ViewerMode::Fullscreen => {
                let _ = viewer.set_fullscreen(true);
            }
            ViewerMode::Windowed => {
                let _ = viewer.set_fullscreen(false);
            }
        }
    }
    move_viewer_to_monitor(&app, settings.monitor_index);
    let _ = app.emit("viewer:settings-updated", &settings);
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
            list_managed_media
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
