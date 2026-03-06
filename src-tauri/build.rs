fn main() {
    // Don't embed requireAdministrator manifest - it breaks cargo run / tauri dev.
    // Instead, the app self-elevates at runtime via ShellExecuteW("runas").
    tauri_build::build()
}
