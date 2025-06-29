mod migrations;

use migrations::get_migrations;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:chatalyst.db", get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            migrations::calculate_image_hash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
