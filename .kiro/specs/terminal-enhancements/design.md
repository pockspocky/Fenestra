# Design Document

## Overview

The terminal enhancements design focuses on improving the user experience of the Fenestra terminal interface by adding three key features: filename auto-completion, colored tips for better visual distinction, and individual command help descriptions accessible through parameters. These enhancements will build upon the existing terminal architecture while maintaining backward compatibility.

## Architecture

The current terminal architecture consists of:
- **Frontend**: HTML/CSS/JavaScript terminal interface (`renderer/terminal.html`)
- **Backend**: IPC handlers in the main process (`src/core/ipcHandlers.js`)
- **Communication**: Electron IPC via `electronAPI.executeTerminalCommand()`

The enhancements will extend this architecture with:
1. **File System API**: New IPC handlers for file system operations and path completion
2. **Enhanced Command Parser**: Extended command parsing to support help parameters
3. **Visual Enhancement System**: CSS classes and JavaScript functions for colored output
4. **Auto-completion Engine**: Tab completion system for files and commands

## Components and Interfaces

### 1. File System Auto-completion Component

**New IPC Handlers:**
```javascript
// In src/core/ipcHandlers.js
ipcMain.handle('terminal/get-file-completions', (_e, { partialPath, currentDir }) => {
  // Returns array of matching files/directories
});

ipcMain.handle('terminal/get-current-directory', (_e) => {
  // Returns current working directory
});
```

**Frontend Auto-completion Engine:**
```javascript
// In renderer/terminal.html
class AutoCompleter {
  async getFileCompletions(partialPath) {
    // Communicates with backend to get file matches
  }
  
  async completeCommand(inputValue, cursorPosition) {
    // Handles both command and file completion
  }
}
```

### 2. Colored Tips System

**CSS Color Scheme:**
```css
.tip { color: #ffaa00; }           /* Orange for tips */
.command-help { color: #00aaff; }  /* Blue for command help */
.parameter { color: #aa00ff; }     /* Purple for parameters */
.example { color: #888888; }       /* Gray for examples */
```

**Output Enhancement Functions:**
```javascript
function printTip(message) {
  print(message, 'tip');
}

function printCommandHelp(message) {
  print(message, 'command-help');
}
```

### 3. Individual Command Help System

**Command Help Data Structure:**
```javascript
const commandHelp = {
  'set-title': {
    description: 'Set the title of a window',
    usage: 'set-title [windowID] "title"',
    parameters: [
      { name: 'windowID', description: 'The ID of the target window' },
      { name: 'title', description: 'The new title (use quotes for spaces)' }
    ],
    examples: [
      'set-title window1 "My Window"',
      'set-title main-window "Updated Title"'
    ]
  },
  // ... other commands
};
```

**Enhanced Command Parser:**
```javascript
function parseCommandWithHelp(cmdStr) {
  const parts = parseCommand(cmdStr);
  const cmd = parts[0]?.toLowerCase();
  
  // Check for help flags
  if (parts.includes('--help') || parts.includes('-h')) {
    return { command: 'help', args: [cmd] };
  }
  
  // Check for help command with specific command
  if (cmd === 'help' && parts.length > 1) {
    return { command: 'help', args: [parts[1]] };
  }
  
  return { command: cmd, args: parts.slice(1) };
}
```

## Data Models

### File Completion Response
```javascript
{
  success: true,
  completions: [
    {
      name: 'filename.txt',
      type: 'file',
      path: '/full/path/to/filename.txt'
    },
    {
      name: 'directory/',
      type: 'directory', 
      path: '/full/path/to/directory'
    }
  ],
  commonPrefix: 'file' // Common prefix for all matches
}
```

### Command Help Response
```javascript
{
  success: true,
  command: 'set-title',
  help: {
    description: 'Set the title of a window',
    usage: 'set-title [windowID] "title"',
    parameters: [...],
    examples: [...],
    tips: ['Use quotes around titles with spaces']
  }
}
```

### Color Classification System
```javascript
const colorTypes = {
  'info': '#ffffff',      // White for regular info
  'success': '#00ff00',   // Green for success
  'error': '#ff0000',     // Red for errors
  'prompt': '#00ff00',    // Green for prompts
  'tip': '#ffaa00',       // Orange for tips
  'command-help': '#00aaff', // Blue for command help
  'parameter': '#aa00ff', // Purple for parameters
  'example': '#888888'    // Gray for examples
};
```

## Error Handling

### File System Access Errors
- **Permission denied**: Graceful fallback with appropriate error message
- **Path not found**: Clear indication of invalid path with suggestions
- **Network paths**: Handle UNC paths and network drives appropriately

### Auto-completion Edge Cases
- **No matches**: Display "No matches found" message
- **Too many matches**: Limit display to first 20 matches with "... and X more" indicator
- **Special characters**: Proper escaping and quoting of paths with spaces/special chars

### Command Help Errors
- **Unknown command**: Suggest similar commands using fuzzy matching
- **Malformed help request**: Clear usage instructions for help system

## Testing Strategy

### Auto-completion Testing
1. **Basic file completion**: Test completion in various directories
2. **Directory traversal**: Test completion across directory boundaries  
3. **Special characters**: Test paths with spaces, quotes, and special characters
4. **Performance**: Test completion with large directories (1000+ files)
5. **Edge cases**: Empty directories, permission-denied directories

### Colored Output Testing
1. **Visual verification**: Manual testing of all color types
2. **Consistency check**: Ensure consistent coloring across all commands
3. **Accessibility**: Verify colors are distinguishable for color-blind users
4. **Terminal compatibility**: Test colors in different terminal environments

### Command Help Testing
1. **Individual command help**: Test `help [command]` for all commands
2. **Help flags**: Test `--help` and `-h` flags with various commands
3. **Error conditions**: Test help for non-existent commands
4. **Formatting**: Verify proper formatting and readability of help output

### Integration Testing
1. **Tab completion flow**: Test complete tab completion workflow
2. **Help system integration**: Test help system with existing commands
3. **Backward compatibility**: Ensure existing functionality remains intact
4. **Performance impact**: Measure impact on terminal responsiveness

## Implementation Phases

### Phase 1: File System Auto-completion
- Implement backend file system APIs
- Add basic tab completion for file paths
- Handle directory vs file distinction

### Phase 2: Colored Tips System  
- Implement CSS color classes
- Update print functions to support color types
- Convert existing tips to use colored output

### Phase 3: Individual Command Help
- Create command help data structure
- Implement help command parsing
- Add help flags support to existing commands

### Phase 4: Integration and Polish
- Integrate all systems
- Performance optimization
- Comprehensive testing and bug fixes