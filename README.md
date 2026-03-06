# NetFresh

🛜 A Windows desktop tool for cleaning up stale network profiles and renumbering them

| Category  | Stack                                          |
| --------- | ---------------------------------------------- |
| Framework | React 19 + TypeScript                          |
| UI        | Tailwind CSS 4 + shadcn/ui                     |
| Backend   | Rust + Tauri 2.0                               |
| Registry  | winreg + PowerShell `Get-NetConnectionProfile` |

## Install

```bash
pnpm install
```

## Usage

> Requires administrator privileges — the app auto-elevates via UAC on launch.

### Development

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

### Features

- List all network profiles with active/stale/offline status
- One-click cleanup of stale auto-numbered profiles + sequential renumbering
- Inline rename any profile by clicking its name
- Delete individual profiles with confirmation
- Auto backup before any destructive operation (exports .reg file)
- Dark/light theme
- i18n support (English / Chinese)

### How It Works

Windows creates a new network profile every time it detects a "new" network, auto-naming them "Network", "Network 2", "Network 3"... The numbers only go up, never reset. VPN / ZeroTier reconnects, router resets, and VM adapter changes all inflate the numbering.

Profiles are stored at:

```
HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles\{GUID}
```

Key fields: `ProfileName`, `Category` (0=Public, 1=Private, 2=Domain), `NameType` (0x6=auto-numbered, 0x35=custom name).

Cleanup logic:

1. Backup registry to `.reg` file
2. Delete inactive auto-numbered profiles
3. Renumber remaining active auto-numbered profiles sequentially
4. Skip custom-named profiles

## License

[MIT](https://opensource.org/licenses/MIT) © Guany
