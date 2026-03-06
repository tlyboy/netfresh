import { invoke } from '@tauri-apps/api/core'
import type { CleanupResult, NetworkProfile } from './types'

export const listProfiles = () => invoke<NetworkProfile[]>('list_profiles')

export const cleanupAndRenumber = () =>
  invoke<CleanupResult>('cleanup_and_renumber')

export const renameProfile = (guid: string, newName: string) =>
  invoke<void>('rename_profile', { guid, newName })

export const deleteProfile = (guid: string) =>
  invoke<void>('delete_profile', { guid })

export const backupProfiles = () => invoke<string>('backup_profiles')
