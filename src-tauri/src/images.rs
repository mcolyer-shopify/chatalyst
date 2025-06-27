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
        Migration {
            version: 5,
            description: "create_app_settings_table",
            sql: "CREATE TABLE app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_conversations_table",
            sql: "CREATE TABLE conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                enabled_tools TEXT, -- JSON string for tool configuration
                archived BOOLEAN DEFAULT FALSE,
                archived_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_conversation_messages_table",
            sql: "CREATE TABLE conversation_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL, -- 'user' or 'assistant'
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                model TEXT,
                image_ids TEXT, -- JSON array of image IDs
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "create_models_cache_table",
            sql: "CREATE TABLE models_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_key TEXT UNIQUE NOT NULL, -- provider:baseURL combination
                models_data TEXT NOT NULL, -- JSON string of models array
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "create_favorite_models_table",
            sql: "CREATE TABLE favorite_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_key TEXT NOT NULL, -- provider:baseURL combination
                model_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider_key, model_id)
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_migration_metadata_table",
            sql: "CREATE TABLE migration_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create_indexes",
            sql: "CREATE INDEX idx_conversations_archived ON conversations(archived);
                  CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
                  CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
                  CREATE INDEX idx_conversation_messages_timestamp ON conversation_messages(timestamp);
                  CREATE INDEX idx_models_cache_timestamp ON models_cache(timestamp);
                  CREATE INDEX idx_favorite_models_provider_key ON favorite_models(provider_key);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_tool_fields_to_conversation_messages",
            sql: "ALTER TABLE conversation_messages ADD COLUMN tool_name TEXT;
                  ALTER TABLE conversation_messages ADD COLUMN tool_call TEXT; -- JSON for tool call arguments
                  ALTER TABLE conversation_messages ADD COLUMN tool_result TEXT; -- JSON for tool result",
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
