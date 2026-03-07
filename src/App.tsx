import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpCircle,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Wifi,
  WifiOff,
  Network,
  Hash,
  Pencil,
  Trash2,
} from 'lucide-react'
import { check } from '@tauri-apps/plugin-updater'
import { toast } from 'sonner'

import Default from './layouts/default'
import { ModeToggle } from '@/components/mode-toggle'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import {
  listProfiles,
  cleanupAndRenumber,
  renameProfile,
  deleteProfile,
  backupProfiles,
  listBackups,
  restoreBackup,
  deleteBackup,
} from '@/lib/commands'
import { useTranslations } from '@/i18n'
import type { BackupEntry, NetworkProfile } from '@/lib/types'

const categoryKeys: Record<number, string> = {
  0: 'category.public',
  1: 'category.private',
  2: 'category.domain',
}

const categoryVariants: Record<number, 'outline' | 'secondary'> = {
  0: 'outline',
  1: 'secondary',
  2: 'secondary',
}

function EditableName({
  profile,
  onSaved,
}: {
  profile: NetworkProfile
  onSaved: () => void
}) {
  const t = useTranslations()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(profile.profile_name)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === profile.profile_name) {
      setEditing(false)
      setValue(profile.profile_name)
      return
    }
    try {
      await renameProfile(profile.guid, trimmed)
      toast.success(
        t('toast.renameSuccess', { from: profile.profile_name, to: trimmed }),
      )
      setEditing(false)
      onSaved()
    } catch (e) {
      toast.error(t('toast.renameError', { error: String(e) }))
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="border-input bg-background focus:ring-ring h-7 w-32 rounded border px-2 text-sm outline-none focus:ring-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setEditing(false)
            setValue(profile.profile_name)
          }
        }}
        onBlur={save}
        autoFocus
      />
    )
  }

  return (
    <span
      className="group inline-flex cursor-pointer items-center gap-1"
      onClick={() => {
        setEditing(true)
        setValue(profile.profile_name)
      }}
    >
      {profile.profile_name}
      <Pencil className="text-muted-foreground size-3 opacity-0 group-hover:opacity-100" />
    </span>
  )
}

function App() {
  const t = useTranslations()
  const [profiles, setProfiles] = useState<NetworkProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'downloading' | 'ready' | 'latest' | 'error'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [backupOpen, setBackupOpen] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const refreshBackups = async () => {
    try {
      setBackups(await listBackups())
    } catch (e) {
      console.error('Failed to list backups:', e)
    }
  }

  const handleRestore = async (entry: BackupEntry) => {
    setRestoring(entry.path)
    try {
      await restoreBackup(entry.path)
      toast.success(t('backup.restoreSuccess', { name: entry.created_at }))
      setBackupOpen(false)
      refresh()
    } catch (e) {
      toast.error(t('backup.restoreError', { error: String(e) }))
    } finally {
      setRestoring(null)
    }
  }

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    try {
      const update = await check()
      if (update) {
        setUpdateVersion(update.version)
        setUpdateStatus('downloading')
        await update.downloadAndInstall()
        setUpdateStatus('ready')
      } else {
        setUpdateStatus('latest')
        setTimeout(() => setUpdateStatus('idle'), 3000)
      }
    } catch (err) {
      console.error('Update check failed:', err)
      setUpdateStatus('error')
      setTimeout(() => setUpdateStatus('idle'), 3000)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listProfiles()
      setProfiles(data)
    } catch (e) {
      toast.error(t('toast.loadError', { error: String(e) }))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleBackup = async () => {
    try {
      const path = await backupProfiles()
      toast.success(t('toast.backupSuccess'), { description: path })
    } catch (e) {
      toast.error(t('toast.backupError', { error: String(e) }))
    }
  }

  const handleCleanup = async () => {
    setOperating(true)
    try {
      const result = await cleanupAndRenumber()
      const msgs: string[] = []
      if (result.deleted_profiles.length > 0) {
        msgs.push(
          t('toast.cleanupDeleted', {
            count: result.deleted_profiles.length,
          }),
        )
      }
      if (result.renamed_profiles.length > 0) {
        const renames = result.renamed_profiles
          .map((r) => `${r.old_name} → ${r.new_name}`)
          .join(', ')
        msgs.push(t('toast.cleanupRenamed', { renames }))
      }
      if (msgs.length === 0) {
        toast.info(t('toast.cleanupOptimal'))
      } else {
        toast.success(msgs.join('；'))
      }
      await refresh()
    } catch (e) {
      toast.error(t('toast.cleanupError', { error: String(e) }))
    } finally {
      setOperating(false)
    }
  }

  const activeCount = profiles.filter((p) => p.is_active).length
  const staleCount = profiles.filter(
    (p) => !p.is_active && p.is_auto_numbered,
  ).length
  const customCount = profiles.filter((p) => !p.is_auto_numbered).length

  const stats = [
    { labelKey: 'stats.total', value: profiles.length, icon: Network },
    { labelKey: 'stats.active', value: activeCount, icon: Wifi },
    { labelKey: 'stats.stale', value: staleCount, icon: WifiOff },
    { labelKey: 'stats.custom', value: customCount, icon: Hash },
  ]

  return (
    <Default>
      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            <h1 className="text-xl font-semibold">{t('app.title')}</h1>
            <span className="text-muted-foreground text-xs">
              {t('version', { version: __APP_VERSION__ })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer"
                  onClick={refresh}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`size-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('tooltip.refresh')}</TooltipContent>
            </Tooltip>
            <Sheet
              open={backupOpen}
              onOpenChange={(open) => {
                setBackupOpen(open)
                if (open) refreshBackups()
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 cursor-pointer"
                    >
                      <Save className="size-4" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('tooltip.backup')}</TooltipContent>
              </Tooltip>
              <SheetContent className="flex flex-col gap-0">
                <SheetHeader className="px-6 pb-4">
                  <SheetTitle>{t('backup.title')}</SheetTitle>
                  <SheetDescription>
                    {t('backup.description')}
                  </SheetDescription>
                </SheetHeader>
                <div className="border-b px-6 pb-4">
                  <Button
                    className="w-full cursor-pointer"
                    onClick={async () => {
                      await handleBackup()
                      refreshBackups()
                    }}
                  >
                    <Save className="size-4" />
                    {t('backup.createNew')}
                  </Button>
                </div>
                <ScrollArea className="flex-1 px-6">
                  <div className="divide-border divide-y">
                    {backups.map((entry) => (
                      <div key={entry.path} className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-xs">
                              {entry.created_at}
                            </p>
                            {entry.profile_names.length > 0 ? (
                              <p className="mt-0.5 text-sm">
                                {entry.profile_names.join(', ')}
                              </p>
                            ) : (
                              <p className="text-muted-foreground mt-0.5 text-sm italic">
                                {t('backup.noMeta')}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 cursor-pointer"
                                      disabled={restoring !== null}
                                    >
                                      {restoring === entry.path ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <RefreshCw className="size-3.5" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {t('backup.confirmTitle')}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t('backup.confirmDesc', {
                                          name: entry.created_at,
                                        })}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="cursor-pointer">
                                        {t('action.cancel')}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="cursor-pointer"
                                        onClick={() => handleRestore(entry)}
                                      >
                                        {t('backup.restore')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('backup.restore')}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-muted-foreground hover:text-destructive size-7 cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {t('backup.deleteTitle')}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t('backup.deleteDesc', {
                                          name: entry.created_at,
                                        })}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="cursor-pointer">
                                        {t('action.cancel')}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                                        onClick={async () => {
                                          try {
                                            await deleteBackup(entry.path)
                                            toast.success(
                                              t('backup.deleteSuccess', {
                                                name: entry.created_at,
                                              }),
                                            )
                                            refreshBackups()
                                          } catch (e) {
                                            toast.error(
                                              t('backup.deleteError', {
                                                error: String(e),
                                              }),
                                            )
                                          }
                                        }}
                                      >
                                        {t('delete.confirm')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t('delete.confirm')}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                    {backups.length === 0 && (
                      <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                        <Save className="size-8 opacity-20" />
                        {t('backup.empty')}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer"
                  onClick={
                    updateStatus === 'ready'
                      ? () => location.reload()
                      : handleCheckUpdate
                  }
                  disabled={
                    updateStatus === 'checking' ||
                    updateStatus === 'downloading'
                  }
                >
                  {updateStatus === 'checking' && (
                    <RefreshCw className="size-4 animate-spin" />
                  )}
                  {updateStatus === 'downloading' && (
                    <Download className="size-4 animate-bounce" />
                  )}
                  {updateStatus === 'ready' && (
                    <ArrowUpCircle className="text-green-500 size-4" />
                  )}
                  {updateStatus === 'latest' && (
                    <Check className="text-green-500 size-4" />
                  )}
                  {(updateStatus === 'idle' || updateStatus === 'error') && (
                    <ArrowUpCircle className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {updateStatus === 'checking' && t('update.checking')}
                {updateStatus === 'downloading' &&
                  t('update.downloading', { version: updateVersion })}
                {updateStatus === 'ready' && t('update.restartToUpdate')}
                {updateStatus === 'latest' && t('update.upToDate')}
                {updateStatus === 'error' && t('update.updateError')}
                {updateStatus === 'idle' && t('update.checkUpdate')}
              </TooltipContent>
            </Tooltip>
            <LocaleSwitcher />
            <ModeToggle />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat) => (
            <Card key={stat.labelKey} className="py-3">
              <CardContent className="flex items-center gap-3 px-4">
                <stat.icon className="text-muted-foreground size-4" />
                <div>
                  <p className="text-2xl leading-none font-semibold">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(stat.labelKey)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action */}
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="cursor-pointer"
                disabled={operating || loading}
              >
                {operating && <Loader2 className="size-4 animate-spin" />}
                {t('action.cleanup')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('action.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('action.confirmDesc', { count: staleCount })}
                  <br />
                  {t('action.confirmBackup')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  {t('action.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="cursor-pointer"
                  onClick={handleCleanup}
                >
                  {t('action.execute')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {staleCount > 0 && (
            <span className="text-muted-foreground text-sm">
              {t('action.staleFound', { count: staleCount })}
            </span>
          )}
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.category')}</TableHead>
                <TableHead>{t('table.adapter')}</TableHead>
                <TableHead>{t('table.ip')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow
                  key={profile.guid}
                  className={!profile.is_active ? 'opacity-50' : ''}
                >
                  <TableCell className="font-medium">
                    <EditableName profile={profile} onSaved={refresh} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={profile.is_active ? 'default' : 'outline'}
                      className="text-xs"
                    >
                      {profile.is_active
                        ? t('status.active')
                        : profile.is_auto_numbered
                          ? t('status.stale')
                          : t('status.offline')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={categoryVariants[profile.category] ?? 'outline'}
                      className="text-xs"
                    >
                      {t(categoryKeys[profile.category] ?? 'category.unknown')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.adapter_name ?? '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {profile.ip_address ?? '-'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-7 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('delete.title')}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('delete.desc', {
                              name: profile.profile_name,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="cursor-pointer">
                            {t('delete.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                            onClick={async () => {
                              try {
                                await deleteProfile(profile.guid)
                                toast.success(
                                  t('toast.deleteSuccess', {
                                    name: profile.profile_name,
                                  }),
                                )
                                refresh()
                              } catch (e) {
                                toast.error(
                                  t('toast.deleteError', {
                                    error: String(e),
                                  }),
                                )
                              }
                            }}
                          >
                            {t('delete.confirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {t('table.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </Default>
  )
}

export default App
