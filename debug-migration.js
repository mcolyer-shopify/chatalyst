// Debug script to troubleshoot conversation migration
// Run this in the browser console

console.log('=== Debugging Conversation Migration ===');

// Check localStorage for existing data
console.log('\n1. Checking localStorage:');
const storageKeys = {
  conversations: 'chatalyst_conversations',
  selectedConversation: 'chatalyst_selected_conversation',
  settings: 'chatalyst-settings',
  modelsCache: 'chatalyst-models-cache',
  favoriteModels: 'chatalyst-favorite-models',
  windowGeometry: 'chatalyst_window_geometry',
  migrationVersion: 'chatalyst_migration_version'
};

Object.entries(storageKeys).forEach(([key, storageKey]) => {
  const data = localStorage.getItem(storageKey);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      console.log(`${key}:`, Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed, parsed);
    } catch {
      console.log(`${key}:`, 'string value:', data);
    }
  } else {
    console.log(`${key}:`, 'not found');
  }
});

// Check if tauri-store exists
console.log('\n2. Checking for existing tauri-store:');
import('@tauri-apps/plugin-store').then(async ({ load }) => {
  try {
    const store = await load('chatalyst-store.json', { autoSave: false });
    console.log('Found tauri-store file');
    
    // Check conversations in store
    const conversations = await store.get('chatalyst_conversations');
    console.log('Conversations in store:', conversations ? conversations.length : 0);
    if (conversations && conversations.length > 0) {
      console.log('Sample conversation:', conversations[0]);
    }
  } catch (error) {
    console.log('No tauri-store found:', error.message);
  }
});

// Force migration re-run
console.log('\n3. To force re-run migration, execute:');
console.log('window.debugMigration()');

// Add debug function to window
window.debugMigration = async function() {
  const { debugMigration } = await import('./src/utils/sqlStorage.js');
  await debugMigration();
  console.log('Migration re-run completed, check logs above');
};