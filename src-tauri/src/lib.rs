mod models;
mod network;
mod registry;

use models::{BackupEntry, CleanupResult, NetworkProfile};

#[tauri::command]
fn list_profiles() -> Result<Vec<NetworkProfile>, String> {
    registry::read_all_profiles()
}

#[tauri::command]
fn cleanup_and_renumber() -> Result<CleanupResult, String> {
    registry::cleanup_and_renumber()
}

#[tauri::command]
fn rename_profile(guid: String, new_name: String) -> Result<(), String> {
    registry::rename_profile(&guid, &new_name)
}

#[tauri::command]
fn delete_profile(guid: String) -> Result<(), String> {
    registry::delete_profile(&guid)
}

#[tauri::command]
fn backup_profiles() -> Result<String, String> {
    registry::export_backup()
}

#[tauri::command]
fn list_backups() -> Result<Vec<BackupEntry>, String> {
    registry::list_backups()
}

#[tauri::command]
fn restore_backup(path: String) -> Result<(), String> {
    registry::restore_backup(&path)
}

#[tauri::command]
fn delete_backup(path: String) -> Result<(), String> {
    registry::delete_backup(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_profiles,
            cleanup_and_renumber,
            rename_profile,
            delete_profile,
            backup_profiles,
            list_backups,
            restore_backup,
            delete_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
