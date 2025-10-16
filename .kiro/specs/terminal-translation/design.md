# Design Document

## Overview

The terminal translation design focuses on systematically converting all Chinese text elements in the terminal interface to English while maintaining the existing functionality and user experience. The translation will cover UI text, command descriptions, error messages, and interactive feedback.

## Architecture

The terminal interface is a single HTML file (`renderer/terminal.html`) that contains:
- Static HTML content with embedded styles
- JavaScript functionality for command processing
- Drag and drop file handling
- Command history and autocomplete features

The translation approach will be:
1. **Direct text replacement** - Replace Chinese strings with English equivalents
2. **Maintain existing structure** - Keep all HTML elements, CSS classes, and JavaScript functionality intact
3. **Preserve formatting** - Maintain spacing, indentation, and visual hierarchy in help text

## Components and Interfaces

### HTML Document Structure
- **Document metadata**: Update `lang` attribute and `<title>` tag
- **Initial terminal output**: Welcome messages and usage hints
- **Drag feedback overlay**: File drop instructions and error messages

### JavaScript Text Content
- **Welcome messages**: Initial terminal startup text
- **Help system**: Complete command reference with descriptions and examples
- **Error handling**: Validation and execution error messages
- **Interactive feedback**: Drag and drop status messages
- **Command categories**: Organized groupings of related commands

### Command Documentation Structure
The help system organizes commands into logical categories:
1. **Basic Commands**: Core terminal operations (help, clear, list)
2. **Window Operations**: Window management commands (title, size, position, visibility)
3. **Picture Windows**: Image display and manipulation commands
4. **Lens System**: Advanced lens and content window commands
5. **Window Storage**: Save, restore, and manage window configurations

## Data Models

### Translation Mapping
Key Chinese to English translations:
- `终端` → `Terminal`
- `可用命令` → `Available Commands`
- `基础命令` → `Basic Commands`
- `窗口操作命令` → `Window Operations`
- `图片窗口命令` → `Picture Window Commands`
- `镜头系统命令` → `Lens System Commands`
- `窗口存储命令` → `Window Storage Commands`

### Command Parameter Descriptions
Standardized English terminology for:
- Window identifiers: `[ID]`, `[windowID]`, `[lensID]`
- File paths: `[path]`, `[filePath]`, `[htmlPath]`
- Dimensions: `[width]`, `[height]`, `[x]`, `[y]`
- Boolean values: `[true/false]`
- Numeric ranges: `[0-1]`, `[0-50]`

## Error Handling

### Validation Messages
- File type validation: Clear English descriptions for supported file types
- Parameter validation: Descriptive error messages for invalid inputs
- Command execution errors: Informative feedback for failed operations

### User Feedback
- Success confirmations in English
- Progress indicators with English labels
- Warning messages for potentially destructive operations

## Testing Strategy

### Manual Testing Approach
1. **Visual verification**: Load terminal and verify all visible text is in English
2. **Command testing**: Execute `help` command and verify all descriptions are translated
3. **Error condition testing**: Trigger various error conditions to verify English error messages
4. **Drag and drop testing**: Test file drop functionality to verify English feedback messages
5. **Interactive testing**: Test command history, autocomplete, and other interactive features

### Translation Quality Assurance
1. **Consistency check**: Ensure consistent terminology across all commands
2. **Clarity verification**: Verify that English descriptions are clear and accurate
3. **Completeness audit**: Confirm all Chinese text has been translated
4. **Formatting preservation**: Ensure help text formatting and alignment is maintained