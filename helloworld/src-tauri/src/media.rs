use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

use crate::models::{ManagedMediaItem, MANAGED_MEDIA_DIR};

pub fn managed_media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dirの取得に失敗: {e}"))?;
    let dir = base.join(MANAGED_MEDIA_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("managed-mediaフォルダ作成失敗: {e}"))?;
    Ok(dir)
}

pub fn unique_destination_path(dir: &Path, source: &Path) -> PathBuf {
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

pub fn collect_managed_media(dir: &Path) -> Vec<ManagedMediaItem> {
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

pub fn delete_managed_media_at(managed_dir: &Path, target_path: &Path) -> Result<(), String> {
    let managed_dir = managed_dir
        .canonicalize()
        .map_err(|e| format!("管理フォルダの解決に失敗: {e}"))?;
    let target_path = target_path
        .canonicalize()
        .map_err(|e| format!("ファイルの解決に失敗: {e}"))?;
    if !target_path.starts_with(&managed_dir) {
        return Err("管理外のファイルは削除できません".to_string());
    }
    if !target_path.is_file() {
        return Err("ファイルが見つかりません".to_string());
    }
    fs::remove_file(&target_path).map_err(|e| format!("ファイル削除失敗: {e}"))?;
    Ok(())
}

pub fn delete_managed_media_file(app: &AppHandle, path: &str) -> Result<Vec<ManagedMediaItem>, String> {
    let dir = managed_media_dir(app)?;
    delete_managed_media_at(&dir, Path::new(path))?;
    Ok(collect_managed_media(&dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_test_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tauri_app_test_{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn unique_destination_path_returns_original_name_when_available() {
        let dir = temp_test_dir();
        let source = Path::new("C:\\incoming\\photo.png");

        let result = unique_destination_path(&dir, source);

        assert_eq!(result, dir.join("photo.png"));
        cleanup(&dir);
    }

    #[test]
    fn unique_destination_path_appends_index_when_file_exists() {
        let dir = temp_test_dir();
        File::create(dir.join("photo.png")).unwrap();
        let source = Path::new("C:\\incoming\\photo.png");

        let result = unique_destination_path(&dir, source);

        assert_eq!(result, dir.join("photo_1.png"));
        cleanup(&dir);
    }

    #[test]
    fn unique_destination_path_skips_multiple_existing_files() {
        let dir = temp_test_dir();
        File::create(dir.join("photo.png")).unwrap();
        File::create(dir.join("photo_1.png")).unwrap();
        let source = Path::new("C:\\incoming\\photo.png");

        let result = unique_destination_path(&dir, source);

        assert_eq!(result, dir.join("photo_2.png"));
        cleanup(&dir);
    }

    #[test]
    fn unique_destination_path_handles_files_without_extension() {
        let dir = temp_test_dir();
        File::create(dir.join("readme")).unwrap();
        let source = Path::new("C:\\incoming\\readme");

        let result = unique_destination_path(&dir, source);

        assert_eq!(result, dir.join("readme_1"));
        cleanup(&dir);
    }

    #[test]
    fn collect_managed_media_sorts_files_case_insensitively() {
        let dir = temp_test_dir();
        File::create(dir.join("Zebra.pdf")).unwrap();
        File::create(dir.join("apple.png")).unwrap();
        File::create(dir.join("Banana.jpg")).unwrap();

        let items = collect_managed_media(&dir);

        assert_eq!(
            items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>(),
            vec!["apple.png", "Banana.jpg", "Zebra.pdf"]
        );
        cleanup(&dir);
    }

    #[test]
    fn delete_managed_media_at_removes_file_in_managed_dir() {
        let dir = temp_test_dir();
        let file_path = dir.join("photo.png");
        File::create(&file_path).unwrap();

        delete_managed_media_at(&dir, &file_path).unwrap();

        assert!(!file_path.exists());
        cleanup(&dir);
    }

    #[test]
    fn delete_managed_media_at_rejects_paths_outside_managed_dir() {
        let dir = temp_test_dir();
        let outside = std::env::temp_dir().join(format!(
            "tauri_app_outside_{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        File::create(&outside).unwrap();

        let result = delete_managed_media_at(&dir, &outside);

        assert!(result.is_err());
        assert!(outside.exists());
        let _ = fs::remove_file(&outside);
        cleanup(&dir);
    }
}
