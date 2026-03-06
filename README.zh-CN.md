# NetFresh

🛜 Windows 网络配置文件清理与重编号工具

| 类别   | 技术栈                                         |
| ------ | ---------------------------------------------- |
| 框架   | React 19 + TypeScript                          |
| UI     | Tailwind CSS 4 + shadcn/ui                     |
| 后端   | Rust + Tauri 2.0                               |
| 注册表 | winreg + PowerShell `Get-NetConnectionProfile` |

## 安装

```bash
pnpm install
```

## 使用说明

> 需要管理员权限 — 应用启动时会自动通过 UAC 提权。

### 开发

```bash
pnpm tauri dev
```

### 构建

```bash
pnpm tauri build
```

### 功能

- 列出所有网络配置文件，标注活跃/残留/离线状态
- 一键清理残留的自动编号配置 + 顺序重编号
- 点击名称内联重命名任意配置
- 单个删除配置（二次确认）
- 操作前自动备份（导出 .reg 文件）
- 暗色/亮色主题切换
- 国际化支持（中文/英文）

### 工作原理

Windows 每次识别到"新"网络连接时，会在注册表中创建配置文件，自动命名为"网络"、"网络 2"、"网络 3"……编号只增不减。VPN / ZeroTier 重连、路由器重置、虚拟机网络变动都会导致编号膨胀。

配置文件存储在：

```
HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles\{GUID}
```

关键字段：`ProfileName`（显示名称）、`Category`（0=公用, 1=专用, 2=域）、`NameType`（0x6=自动编号, 0x35=自定义名称）。

清理逻辑：

1. 备份注册表到 `.reg` 文件
2. 删除非活跃的自动编号配置
3. 将剩余活跃的自动编号配置按顺序重编号
4. 跳过自定义名称的配置

## 使用许可

[MIT](https://opensource.org/licenses/MIT) © Guany
