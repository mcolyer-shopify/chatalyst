use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredImage {
    pub id: i64,
    pub hash: String,
    pub data: Vec<u8>,
    pub mime_type: String,
    pub size: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageReference {
    pub id: i64,
    pub image_id: i64,
    pub conversation_id: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub id: i64,
    pub hash: String,
    pub mime_type: String,
    pub size: i64,
    pub created_at: String,
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_images_table",
            sql: "CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash TEXT UNIQUE NOT NULL,
                data BLOB NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_image_references_table",
            sql: "CREATE TABLE image_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                conversation_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
                UNIQUE(image_id, conversation_id)
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_images_hash_index",
            sql: "CREATE INDEX idx_images_hash ON images(hash);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_image_references_conversation_index",
            sql: "CREATE INDEX idx_image_references_conversation ON image_references(conversation_id);",
            kind: MigrationKind::Up,
        },
    ]
}

fn calculate_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

// Simple hash calculation for image deduplication  
#[tauri::command]
pub async fn calculate_image_hash(data: Vec<u8>) -> Result<String, String> {
    Ok(calculate_hash(&data))
}

// Placeholder functions - the actual database operations will be handled from frontend
// using direct SQL calls through the tauri-plugin-sql

#[tauri::command]
pub async fn store_image(
    _data: Vec<u8>,
    _mime_type: String,
    _conversation_id: String,
) -> Result<ImageMetadata, String> {
    // This will be handled from the frontend using SQL calls
    Err("Use frontend SQL implementation".to_string())
}

#[tauri::command]
pub async fn get_image(_image_id: i64) -> Result<StoredImage, String> {
    // This will be handled from the frontend using SQL calls
    Err("Use frontend SQL implementation".to_string())
}

#[tauri::command]
pub async fn get_image_by_hash(_hash: String) -> Result<Option<StoredImage>, String> {
    // This will be handled from the frontend using SQL calls
    Ok(None)
}

#[tauri::command]
pub async fn get_conversation_images(_conversation_id: String) -> Result<Vec<ImageMetadata>, String> {
    // This will be handled from the frontend using SQL calls
    Ok(vec![])
}

#[tauri::command]
pub async fn delete_conversation_images(_conversation_id: String) -> Result<i64, String> {
    // This will be handled from the frontend using SQL calls
    Ok(0)
}

#[tauri::command]
pub async fn cleanup_orphaned_images() -> Result<i64, String> {
    // This will be handled from the frontend using SQL calls
    Ok(0)
}

#[tauri::command]
pub async fn get_image_stats() -> Result<(i64, i64), String> {
    // This will be handled from the frontend using SQL calls
    Ok((0, 0))
}