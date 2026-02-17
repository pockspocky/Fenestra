# Email Templates

This directory contains HTML templates for the Fenestra email system.

## Available Templates

### welcome.html
A complete welcome email template with:
- Styled banner with gradient background
- Feature grid showcasing game elements
- Interactive counter demo with increment/decrement buttons
- Inline JavaScript demonstrating event handlers
- Responsive design with hover effects

**Usage:**
```json
{
  "id": "welcome-001",
  "senderName": "System Administrator",
  "senderEmail": "admin@fenestra.game",
  "subject": "Welcome to Fenestra",
  "bodyFile": "welcome.html",
  "bodyType": "html-file",
  "timestamp": "2025-02-14T20:00:00.000Z",
  "isRead": false
}
```

### welcome-with-assets.html
An advanced template demonstrating asset path resolution:
- Uses relative image paths (images/placeholder.svg)
- References external CSS (styles/email-theme.css)
- Loads external JavaScript (scripts/demo.js)
- Shows how all relative paths are automatically resolved

**Usage:**
```json
{
  "id": "welcome-002",
  "senderName": "System Administrator",
  "senderEmail": "admin@fenestra.game",
  "subject": "Welcome - Asset Demo",
  "bodyFile": "welcome-with-assets.html",
  "bodyType": "html-file",
  "timestamp": "2025-02-14T20:00:00.000Z",
  "isRead": false
}
```

## Directory Structure

```
templates/
├── README.md                      # This file
├── welcome.html                   # Basic welcome template (self-contained)
├── welcome-with-assets.html       # Advanced template with external assets
├── images/
│   └── placeholder.svg            # Example image asset
├── styles/
│   └── email-theme.css           # Example CSS stylesheet
└── scripts/
    └── demo.js                    # Example JavaScript file
```

## Creating New Templates

1. Create your HTML file in this directory or a subdirectory
2. Use relative paths for any assets (images, CSS, scripts)
3. All relative paths will be resolved relative to your HTML file's location
4. Scripts and inline event handlers are fully supported

## Path Resolution

- **Relative paths** (e.g., `images/logo.png`) are resolved relative to the HTML file's directory
- **Absolute paths** (e.g., `/custom/image.png`) are resolved relative to the project root
- All paths are automatically rewritten by the email system for correct loading

## Features

- ✅ Full HTML5 support
- ✅ Inline and external CSS
- ✅ Inline and external JavaScript
- ✅ Event handlers and DOM manipulation
- ✅ Relative asset path resolution
- ✅ Subdirectory organization
- ✅ No sanitization (scripts allowed)

## Examples

### Using Images
```html
<!-- Relative to HTML file -->
<img src="images/logo.png" alt="Logo">

<!-- In subdirectory -->
<img src="assets/icons/star.png" alt="Star">
```

### Using CSS
```html
<!-- External stylesheet -->
<link rel="stylesheet" href="styles/theme.css">

<!-- Inline styles -->
<style>
  .custom { color: #667eea; }
</style>
```

### Using JavaScript
```html
<!-- External script -->
<script src="scripts/utils.js"></script>

<!-- Inline script -->
<script>
  console.log('Email loaded');
  document.querySelector('.button').addEventListener('click', () => {
    console.log('Button clicked');
  });
</script>
```

## Notes

- Templates are cached when first loaded
- To reload a template, touch the email JSON file or restart the application
- Error messages are displayed in the email body if a template fails to load
- All assets must be within the project root directory
