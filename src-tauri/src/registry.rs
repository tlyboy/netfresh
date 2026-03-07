use crate::models::{BackupEntry, CleanupResult, NetworkProfile, RenameEntry};
use crate::network::{get_active_connections, ActiveConnection};
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;
use winreg::enums::*;
use winreg::RegKey;

const PROFILES_PATH: &str =
    r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles";
const SIGNATURES_PATH: &str =
    r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Signatures\Unmanaged";

pub fn read_all_profiles() -> Result<Vec<NetworkProfile>, String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let profiles_key = hklm
        .open_subkey_with_flags(PROFILES_PATH, KEY_READ)
        .map_err(|e| format!("Failed to open Profiles registry: {e}"))?;

    let active = get_active_connections().unwrap_or_default();

    let mut results = Vec::new();
    for guid in profiles_key.enum_keys().filter_map(|k| k.ok()) {
        if let Ok(sub) = profiles_key.open_subkey_with_flags(&guid, KEY_READ) {
            let profile_name: String = sub.get_value("ProfileName").unwrap_or_default();
            let description: String = sub.get_value("Description").unwrap_or_default();
            let category: u32 = sub.get_value("Category").unwrap_or(0);
            let name_type: u32 = sub.get_value("NameType").unwrap_or(0);

            let active_conn = find_active(&active, &profile_name);
            let is_auto = name_type == 6 && is_network_pattern(&profile_name);

            results.push(NetworkProfile {
                guid: guid.clone(),
                profile_name,
                description,
                category,
                name_type,
                is_active: active_conn.is_some(),
                is_auto_numbered: is_auto,
                adapter_name: active_conn.as_ref().map(|c| c.adapter_name.clone()),
                ip_address: active_conn.and_then(|c| c.ip_address.clone()),
            });
        }
    }

    results.sort_by_key(|p| (!p.is_active, p.profile_name.clone()));
    Ok(results)
}

fn find_active<'a>(
    connections: &'a [ActiveConnection],
    profile_name: &str,
) -> Option<&'a ActiveConnection> {
    connections.iter().find(|c| c.profile_name == profile_name)
}

pub fn delete_profile(guid: &str) -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let profiles_key = hklm
        .open_subkey_with_flags(PROFILES_PATH, KEY_ALL_ACCESS)
        .map_err(|e| format!("Failed to open Profiles registry: {e}"))?;

    profiles_key
        .delete_subkey_all(guid)
        .map_err(|e| format!("Failed to delete profile {guid}: {e}"))?;

    // Clean up associated signature
    if let Ok(sig_key) = hklm.open_subkey_with_flags(SIGNATURES_PATH, KEY_ALL_ACCESS) {
        for sig_guid in sig_key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(sub) = sig_key.open_subkey(&sig_guid) {
                let profile_guid: String = sub.get_value("ProfileGuid").unwrap_or_default();
                if profile_guid.eq_ignore_ascii_case(guid)
                    || profile_guid
                        .trim_matches(|c| c == '{' || c == '}')
                        .eq_ignore_ascii_case(guid.trim_matches(|c| c == '{' || c == '}'))
                {
                    let _ = sig_key.delete_subkey_all(&sig_guid);
                }
            }
        }
    }

    Ok(())
}

pub fn rename_profile(guid: &str, new_name: &str) -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let profiles_key = hklm
        .open_subkey_with_flags(PROFILES_PATH, KEY_ALL_ACCESS)
        .map_err(|e| format!("Failed to open Profiles registry: {e}"))?;

    let sub = profiles_key
        .open_subkey_with_flags(guid, KEY_SET_VALUE)
        .map_err(|e| format!("Failed to open profile {guid}: {e}"))?;

    sub.set_value("ProfileName", &new_name)
        .map_err(|e| format!("Failed to rename profile: {e}"))?;

    Ok(())
}

pub fn export_backup() -> Result<String, String> {
    let docs = dirs_next::document_dir()
        .or_else(dirs_next::home_dir)
        .ok_or("Cannot find documents directory")?;

    let backup_dir = docs.join("NetFresh").join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {e}"))?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let backup_path = backup_dir.join(format!("netfresh-backup-{timestamp}.reg"));
    let backup_str = backup_path.to_string_lossy().to_string();

    let reg_path = format!(
        "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\NetworkList\\Profiles"
    );

    let output = Command::new("reg")
        .args(["export", &reg_path, &backup_str, "/y"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run reg export: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "reg export failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Save metadata sidecar
    let profiles = read_all_profiles().unwrap_or_default();
    let profile_names: Vec<String> = profiles.iter().map(|p| p.profile_name.clone()).collect();
    let meta = serde_json::json!({
        "created_at": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        "profile_names": profile_names,
    });
    let meta_path = backup_dir.join(format!("netfresh-backup-{timestamp}.json"));
    let _ = std::fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap_or_default());

    Ok(backup_str)
}

pub fn list_backups() -> Result<Vec<BackupEntry>, String> {
    let docs = dirs_next::document_dir()
        .or_else(dirs_next::home_dir)
        .ok_or("Cannot find documents directory")?;

    let backup_dir = docs.join("NetFresh").join("backups");
    if !backup_dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<BackupEntry> = std::fs::read_dir(&backup_dir)
        .map_err(|e| format!("Failed to read backup directory: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "reg")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let reg_path = e.path();
            let meta_path = reg_path.with_extension("json");

            // Try reading metadata from JSON sidecar
            let (created_at, profile_names) = if meta_path.exists() {
                let content = std::fs::read_to_string(&meta_path).ok()?;
                let meta: serde_json::Value = serde_json::from_str(&content).ok()?;
                let created = meta["created_at"].as_str().unwrap_or("").to_string();
                let names = meta["profile_names"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                (created, names)
            } else {
                // Fallback for old backups without metadata
                let metadata = e.metadata().ok()?;
                let created = metadata
                    .created()
                    .ok()
                    .map(|t| {
                        let dt: chrono::DateTime<chrono::Local> = t.into();
                        dt.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                    .unwrap_or_default();
                (created, Vec::new())
            };

            Some(BackupEntry {
                path: reg_path.to_string_lossy().to_string(),
                created_at,
                profile_names,
            })
        })
        .collect();

    entries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(entries)
}

pub fn delete_backup(path: &str) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|e| format!("Failed to delete backup: {e}"))?;
    let meta_path = std::path::Path::new(path).with_extension("json");
    let _ = std::fs::remove_file(meta_path);
    Ok(())
}

pub fn restore_backup(path: &str) -> Result<(), String> {
    let output = Command::new("reg")
        .args(["import", path])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run reg import: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "reg import failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

fn is_auto_numbered(profile: &NetworkProfile) -> bool {
    profile.name_type == 6 && is_network_pattern(&profile.profile_name)
}

fn is_network_pattern(name: &str) -> bool {
    if name == "\u{7f51}\u{7edc}" {
        return true; // "网络"
    }
    if let Some(rest) = name.strip_prefix("\u{7f51}\u{7edc} ") {
        return rest.parse::<u32>().is_ok();
    }
    false
}

pub fn cleanup_and_renumber() -> Result<CleanupResult, String> {
    let backup_path = export_backup()?;

    let profiles = read_all_profiles()?;

    // Delete inactive auto-numbered profiles only
    let mut deleted = Vec::new();
    for p in &profiles {
        if !p.is_active && p.is_auto_numbered {
            if let Err(e) = delete_profile(&p.guid) {
                eprintln!("Warning: {e}");
            } else {
                deleted.push(p.profile_name.clone());
            }
        }
    }

    // Renumber active auto-numbered profiles
    let active = get_active_connections().unwrap_or_default();
    let fresh_profiles = read_all_profiles()?;

    let mut to_renumber: Vec<&NetworkProfile> = fresh_profiles
        .iter()
        .filter(|p| p.is_active && is_auto_numbered(p))
        .collect();

    // Sort: local adapters first (non-virtual), then by interface index
    to_renumber.sort_by_key(|p| {
        let conn = active.iter().find(|a| a.profile_name == p.profile_name);
        let is_virtual = conn
            .map(|a| {
                let name = a.adapter_name.to_lowercase();
                name.contains("zerotier")
                    || name.contains("vmware")
                    || name.contains("hyper-v")
                    || name.contains("virtualbox")
                    || name.contains("wsl")
            })
            .unwrap_or(false);
        (is_virtual, conn.map(|a| a.interface_index).unwrap_or(u32::MAX))
    });

    // First pass: rename to temp names to avoid conflicts
    for (i, p) in to_renumber.iter().enumerate() {
        let temp = format!("__netfresh_temp_{i}");
        let _ = rename_profile(&p.guid, &temp);
    }

    // Second pass: rename to final names
    let mut renamed = Vec::new();
    for (i, p) in to_renumber.iter().enumerate() {
        let new_name = if i == 0 {
            "\u{7f51}\u{7edc}".to_string() // "网络"
        } else {
            format!("\u{7f51}\u{7edc} {}", i + 1) // "网络 2", "网络 3", ...
        };
        rename_profile(&p.guid, &new_name)?;
        renamed.push(RenameEntry {
            guid: p.guid.clone(),
            old_name: p.profile_name.clone(),
            new_name,
        });
    }

    Ok(CleanupResult {
        deleted_profiles: deleted,
        renamed_profiles: renamed,
        backup_path,
    })
}
