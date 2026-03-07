export interface NetworkProfile {
  guid: string
  profile_name: string
  description: string
  category: number
  name_type: number
  is_active: boolean
  is_auto_numbered: boolean
  adapter_name: string | null
  ip_address: string | null
}

export interface CleanupResult {
  deleted_profiles: string[]
  renamed_profiles: RenameEntry[]
  backup_path: string
}

export interface RenameEntry {
  guid: string
  old_name: string
  new_name: string
}

export interface BackupEntry {
  path: string
  created_at: string
  profile_names: string[]
}
