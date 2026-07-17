use std::fs;

use tauri::{
    App, AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

use crate::models::{
    Bounds, MonitorInfo, PersistedState, ViewerMode, ViewerSettings, WindowSize, CONTROL_LABEL,
    SETTINGS_LABEL, VIEWER_LABEL,
};

fn state_path(app: &AppHandle) -> Option<std::path::PathBuf> {
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

pub fn attach_window_persistence(window: &WebviewWindow) {
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

pub fn attach_control_window_handlers(window: &WebviewWindow) {
    attach_window_persistence(window);
    let app = window.app_handle().clone();
    let cloned = window.clone();
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::CloseRequested { .. }) {
            save_window_bounds(&cloned);
            app.exit(0);
        }
    });
}

pub fn attach_viewer_window_handlers(window: &WebviewWindow) {
    attach_window_persistence(window);
    let cloned = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Keep the viewer window alive so it can be shown again quickly.
            api.prevent_close();
            save_window_bounds(&cloned);
            let _ = cloned.hide();
        }
    });
}

pub fn attach_settings_window_handlers(window: &WebviewWindow) {
    attach_window_persistence(window);
    let cloned = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Keep the settings window alive so it can be shown again quickly.
            api.prevent_close();
            save_window_bounds(&cloned);
            let _ = cloned.hide();
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

fn build_viewer_window(app: &AppHandle) -> Result<WebviewWindow, tauri::Error> {
    WebviewWindowBuilder::new(app, VIEWER_LABEL, WebviewUrl::App("index.html".into()))
        .title("Viewer")
        .inner_size(1200.0, 900.0)
        .build()
}

fn build_settings_window(app: &AppHandle) -> Result<WebviewWindow, tauri::Error> {
    WebviewWindowBuilder::new(app, SETTINGS_LABEL, WebviewUrl::App("index.html".into()))
        .title("Settings")
        .inner_size(420.0, 540.0)
        .visible(false)
        .build()
}

fn initialize_viewer_window(app: &AppHandle, viewer: &WebviewWindow) {
    attach_viewer_window_handlers(viewer);
    let state = load_state(app);
    let has_saved = apply_saved_bounds(viewer, &state);
    if !has_saved {
        auto_place_windows(app);
    }
}

fn initialize_settings_window(app: &AppHandle, settings: &WebviewWindow) {
    let _ = settings.set_always_on_top(true);
    attach_settings_window_handlers(settings);
    let state = load_state(app);
    let _ = apply_saved_bounds(settings, &state);
}

pub fn ensure_windows(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    if app_handle.get_webview_window(VIEWER_LABEL).is_none() {
        build_viewer_window(&app_handle)?;
    }

    if app_handle.get_webview_window(SETTINGS_LABEL).is_none() {
        let settings = build_settings_window(&app_handle)?;
        initialize_settings_window(&app_handle, &settings);
    }

    let state = load_state(&app_handle);

    if let Some(control) = app_handle.get_webview_window(CONTROL_LABEL) {
        attach_control_window_handlers(&control);
        let _ = apply_saved_bounds(&control, &state);
    }
    if let Some(viewer) = app_handle.get_webview_window(VIEWER_LABEL) {
        attach_viewer_window_handlers(&viewer);
        let has_saved = apply_saved_bounds(&viewer, &state);
        if !has_saved {
            auto_place_windows(&app_handle);
        }
    }
    if let Some(settings) = app_handle.get_webview_window(SETTINGS_LABEL) {
        attach_settings_window_handlers(&settings);
        let _ = apply_saved_bounds(&settings, &state);
    }

    Ok(())
}

pub fn open_settings_window(app: &AppHandle) -> Result<(), String> {
    let settings_window = if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        win
    } else {
        match build_settings_window(app) {
            Ok(created) => {
                initialize_settings_window(app, &created);
                created
            }
            Err(e) => return Err(format!("設定ウインドウ作成失敗: {e}")),
        }
    };

    settings_window
        .unminimize()
        .map_err(|e| format!("設定ウインドウ最小化解除失敗: {e}"))?;
    settings_window
        .show()
        .map_err(|e| format!("設定ウインドウ表示失敗: {e}"))?;
    settings_window
        .set_focus()
        .map_err(|e| format!("設定ウインドウフォーカス失敗: {e}"))?;
    Ok(())
}

pub fn toggle_titlebar(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(VIEWER_LABEL) {
        if let Ok(current) = win.is_decorated() {
            let _ = win.set_decorations(!current);
        }
    }
}

pub fn toggle_viewer_mode(app: &AppHandle) {
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

pub fn get_viewer_window_size(app: &AppHandle) -> Option<WindowSize> {
    let viewer = app.get_webview_window(VIEWER_LABEL)?;
    let size = viewer.inner_size().ok()?;
    Some(WindowSize {
        width: size.width,
        height: size.height,
    })
}

pub fn close_viewer_window(app: &AppHandle) {
    if let Some(viewer) = app.get_webview_window(VIEWER_LABEL) {
        save_window_bounds(&viewer);
        let _ = viewer.hide();
    }
}

pub fn ensure_viewer_window(app: &AppHandle) -> Result<(), String> {
    let viewer = if let Some(win) = app.get_webview_window(VIEWER_LABEL) {
        win
    } else {
        let created = build_viewer_window(app).map_err(|e| format!("Viewerウインドウ作成失敗: {e}"))?;
        initialize_viewer_window(app, &created);
        created
    };
    viewer
        .unminimize()
        .map_err(|e| format!("Viewerウインドウ最小化解除失敗: {e}"))?;
    viewer
        .show()
        .map_err(|e| format!("Viewerウインドウ表示失敗: {e}"))?;
    viewer
        .set_focus()
        .map_err(|e| format!("Viewerウインドウフォーカス失敗: {e}"))?;
    Ok(())
}

pub fn list_monitors(app: &AppHandle) -> Vec<MonitorInfo> {
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

pub fn apply_viewer_settings(app: &AppHandle, settings: ViewerSettings) {
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
    move_viewer_to_monitor(app, settings.monitor_index);
    let _ = app.emit("viewer:settings-updated", &settings);
}
