use serde::Deserialize;
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Deserialize)]
struct PsConnectionProfile {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "InterfaceAlias")]
    interface_alias: String,
    #[serde(rename = "InterfaceIndex")]
    interface_index: u32,
}

#[derive(Debug, Deserialize)]
struct PsIpAddress {
    #[serde(rename = "IPAddress")]
    ip_address: String,
}

#[derive(Debug, Clone)]
pub struct ActiveConnection {
    pub profile_name: String,
    pub adapter_name: String,
    pub interface_index: u32,
    pub ip_address: Option<String>,
}

pub fn get_active_connections() -> Result<Vec<ActiveConnection>, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, InterfaceIndex | ConvertTo-Json -Compress",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run PowerShell: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let profiles: Vec<PsConnectionProfile> = if stdout.trim().starts_with('[') {
        serde_json::from_str(stdout.trim())
    } else if stdout.trim().starts_with('{') {
        serde_json::from_str::<PsConnectionProfile>(stdout.trim()).map(|p| vec![p])
    } else {
        return Ok(vec![]);
    }
    .map_err(|e| format!("Failed to parse connection profiles: {e}"))?;

    let mut connections = Vec::new();
    for profile in profiles {
        let ip = get_ip_for_interface(profile.interface_index);
        connections.push(ActiveConnection {
            profile_name: profile.name,
            adapter_name: profile.interface_alias,
            interface_index: profile.interface_index,
            ip_address: ip,
        });
    }

    Ok(connections)
}

fn get_ip_for_interface(index: u32) -> Option<String> {
    let cmd = format!(
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetIPAddress -InterfaceIndex {index} -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1 IPAddress | ConvertTo-Json -Compress"
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", &cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let addr: PsIpAddress = serde_json::from_str(stdout.trim()).ok()?;
    Some(addr.ip_address)
}
