mod images;

use images::get_migrations;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:images.db", get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            images::calculate_image_hash,
            images::store_image,
            images::get_image,
            images::get_image_by_hash,
            images::get_conversation_images,
            images::delete_conversation_images,
            images::cleanup_orphaned_images,
            images::get_image_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
