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
