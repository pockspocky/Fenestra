# Fenestra Configuration Guide

This guide explains how to configure Fenestra's game data directory and other settings.

## Configuration System Overview

Fenestra uses a configuration system that allows you to customize various aspects of the application, particularly the location of the game data directory where all user files and game content are stored.

## Configuration File

The configuration is stored in `.fenestra-config.json` in the project root directory. This file is automatically created when you first modify any configuration settings.

### Default Configuration

```json
{
  "gameDataDirectory": "./game-data",
  "allowedFileExtensions": [".fenestra", ".txt", ".md", ".json"],
  "maxDirectoryDepth": 10,
  "enableDirectoryLocking": true
}
```

## Game Data Directory

The game data directory is where Fenestra stores all user-accessible files, including:
- `.fenestra` window configuration files
- User-created content
- Game progression data
- Any files accessible through the terminal interface

### Security Restrictions

For security reasons, the game data directory must be:
- Within the project directory boundaries
- Cannot be set to a location outside the project scope
- Cannot use paths that would allow directory traversal attacks

## Configuration Methods

### 1. Terminal Commands

You can manage configuration through the terminal interface:

#### View Current Configuration
```bash
config get
```

#### View Game Data Directory
```bash
config get game-data-dir
```

#### Set Game Data Directory
```bash
config set game-data-dir ./my-custom-data
```

#### Reset to Defaults
```bash
config reset
```

### 2. Programmatic Access

You can also access configuration programmatically:

```javascript
import { 
  getConfig, 
  getGameDataDirectory, 
  setGameDataDirectory,
  resetConfigToDefaults 
} from './src/core/config.js';

// Get current configuration
const config = getConfig();

// Get game data directory
const gameDataDir = getGameDataDirectory();

// Set game data directory
const result = setGameDataDirectory('./new-data-dir');
if (result.success) {
  console.log('Directory updated:', result.path);
} else {
  console.error('Failed:', result.error);
}

// Reset to defaults
resetConfigToDefaults();
```

## Configuration Properties

### gameDataDirectory
- **Type**: String
- **Default**: `"./game-data"`
- **Description**: Relative path to the directory containing all game data
- **Restrictions**: Must be within project boundaries

### allowedFileExtensions
- **Type**: Array of strings
- **Default**: `[".fenestra", ".txt", ".md", ".json"]`
- **Description**: File extensions that are allowed in file operations

### maxDirectoryDepth
- **Type**: Number
- **Default**: `10`
- **Description**: Maximum depth for directory traversal operations

### enableDirectoryLocking
- **Type**: Boolean
- **Default**: `true`
- **Description**: Whether to enable the door-key system for directory access control

## Examples

### Setting Up a Custom Data Directory

1. Create your custom directory:
```bash
mkdir ./my-game-files
```

2. Set it as the game data directory:
```bash
config set game-data-dir ./my-game-files
```

3. Verify the change:
```bash
config get game-data-dir
```

### Organizing Game Content

You can organize your game content in subdirectories within the game data directory:

```
game-data/
├── levels/
│   ├── level1.fenestra
│   └── level2.fenestra
├── images/
│   ├── background.png
│   └── sprites/
└── saves/
    └── progress.json
```

### Resetting Configuration

If you need to reset all configuration to defaults:

```bash
config reset
```

This will:
- Reset the game data directory to `./game-data`
- Restore all other settings to their default values
- Create the default game data directory if it doesn't exist

## Troubleshooting

### "Game data directory must be within project scope"

This error occurs when you try to set the game data directory to a location outside the project. For security reasons, this is not allowed. Use a relative path within the project instead.

**Invalid:**
```bash
config set game-data-dir ../outside-project
config set game-data-dir /absolute/path/somewhere
```

**Valid:**
```bash
config set game-data-dir ./my-data
config set game-data-dir ./content/game-files
```

### Configuration File Corruption

If your configuration file becomes corrupted, you can:

1. Delete the configuration file:
```bash
rm .fenestra-config.json
```

2. Restart the application (it will recreate with defaults)

Or use the reset command:
```bash
config reset
```

## Best Practices

1. **Use descriptive directory names**: Choose clear names for your game data directory
2. **Keep it organized**: Use subdirectories to organize different types of content
3. **Backup important data**: The game data directory contains your progress and custom content
4. **Test changes**: After changing the configuration, verify that file operations still work correctly

## Integration with File Completion

The configuration system is fully integrated with Fenestra's file completion system. When you change the game data directory:

- File completion will automatically use the new directory as the root
- All path validation will respect the new boundaries
- Directory navigation will be restricted to the configured scope
- The door-key system will apply to the new directory structure

This ensures that all file operations remain secure and consistent regardless of your configuration choices.
