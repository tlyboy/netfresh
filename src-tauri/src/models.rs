use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkProfile {
    pub guid: String,
    pub profile_name: String,
    pub description: String,
    pub category: u32,
    pub name_type: u32,
    pub is_active: bool,
    pub is_auto_numbered: bool,
    pub adapter_name: Option<String>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResult {
    pub deleted_profiles: Vec<String>,
    pub renamed_profiles: Vec<RenameEntry>,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameEntry {
    pub guid: String,
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntry {
    pub path: String,
    pub created_at: String,
    pub profile_names: Vec<String>,
}
