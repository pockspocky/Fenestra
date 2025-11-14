# Email System Documentation

## Overview

The Fenestra email system provides a complete email receiver interface with real-time file monitoring, validation, and action support.

## Error Handling

The email system includes comprehensive error handling and validation. For details, see the error handling features:

### File System Errors
- Auto-creation of inbox directory
- Permission validation
- Read-only detection
- Inaccessible directory handling

### JSON Validation
- Malformed JSON handling
- Schema validation
- Required field checking
- Type validation

### Email Operations
- Parameter validation
- Sorting error handling
- ID validation
- Read-only mode protection

### File Watcher
- Initialization checks
- Event error handling
- Continues operation despite errors

## Testing

### Quick Start Testing

The email system can be tested using the test inbox located at `game-data/test-inbox/`. This directory contains sample emails demonstrating various features:

1. **Welcome email** - Basic text email
2. **HTML email** - Email with HTML content
3. **Email with attachments** - Demonstrates attachment display
4. **Action emails** - Emails with various action types (create-window, create-door, create-lens, open-path, execute-function)
5. **Multiple actions** - Email with multiple action buttons
6. **Invalid files** - For testing error handling (malformed JSON, invalid schema)

### Manual Testing Steps

1. Start the application: `npm start`
2. Open the email window (Ctrl+E or Cmd+E)
3. Emails from `game-data/test-inbox/` will be loaded automatically
4. Test real-time updates by creating new email files in the inbox

### Creating Test Emails

Create a new email file in the inbox directory:

```bash
cat > ./inbox/test-email.json << 'EOF'
{
  "id": "test-001",
  "senderName": "Test Sender",
  "senderEmail": "test@example.com",
  "subject": "Test Email",
  "body": "This is a test email.",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false,
  "priority": "normal",
  "bodyType": "text"
}
EOF
```

The email should appear in the email window within 2 seconds.

## Inbox Location

The email inbox is located at `./inbox/` in the project root directory. This location was chosen for easier development and testing.

## Integration

The email system is fully integrated with Fenestra's core systems:

- **App Startup**: Email system initializes during app startup
- **App Shutdown**: Email system cleanup during app shutdown
- **Window Management**: Uses existing window creation patterns
- **Logging**: Uses consistent logging patterns
- **Error Handling**: Follows existing error handling patterns
- **Global Hotkey**: Ctrl+E / Cmd+E to toggle email window

## Success Criteria

The email system is working correctly when:
- ✅ Emails load and display correctly
- ✅ File watcher detects changes within 2 seconds
- ✅ Validation catches invalid emails
- ✅ Mark as read persists to file
- ✅ Actions trigger game events
- ✅ No memory leaks or crashes
- ✅ Graceful error handling
- ✅ Clean resource cleanup
