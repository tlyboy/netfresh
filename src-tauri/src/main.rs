// Always hide console window (needed for self-elevation to avoid black console)
#![windows_subsystem = "windows"]

fn is_elevated() -> bool {
    use std::mem;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation: TOKEN_ELEVATION = mem::zeroed();
        let mut size = 0u32;
        let ret = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        );
        windows_sys::Win32::Foundation::CloseHandle(token);
        ret != 0 && elevation.TokenIsElevated != 0
    }
}

/// Launch an elevated copy of ourselves and wait for it to exit.
/// Returns Some(exit_code) on success, None if elevation was cancelled.
fn relaunch_elevated_and_wait() -> Option<u32> {
    use std::mem;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };

    let exe = std::env::current_exe().unwrap_or_default();
    let exe_wide: Vec<u16> = exe
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let verb: Vec<u16> = "runas\0".encode_utf16().collect();

    let cwd = std::env::current_dir().unwrap_or_default();
    let cwd_wide: Vec<u16> = cwd
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut sei: SHELLEXECUTEINFOW = mem::zeroed();
        sei.cbSize = mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.fMask = SEE_MASK_NOCLOSEPROCESS;
        sei.lpVerb = verb.as_ptr();
        sei.lpFile = exe_wide.as_ptr();
        sei.lpDirectory = cwd_wide.as_ptr();
        sei.nShow = 1; // SW_SHOWNORMAL

        if ShellExecuteExW(&mut sei) == 0 || sei.hProcess.is_null() {
            return None; // User cancelled UAC or error
        }

        // Wait for the elevated process to finish (keeps dev server alive)
        WaitForSingleObject(sei.hProcess, INFINITE);

        let mut exit_code: u32 = 0;
        GetExitCodeProcess(sei.hProcess, &mut exit_code);
        CloseHandle(sei.hProcess);

        Some(exit_code)
    }
}

fn main() {
    if !is_elevated() {
        if let Some(code) = relaunch_elevated_and_wait() {
            std::process::exit(code as i32);
        }
        // User cancelled UAC — continue without elevation (will show permission errors)
    }

    netfresh_lib::run()
}
