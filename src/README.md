# Source Code - Drive Images → PDF Extension

## 📁 Contents

This folder contains the **source code** for the Chrome extension:

- **`manifest.json`** - Extension configuration and permissions
- **`content.js`** - Main extension logic and functionality  
- **`styles.css`** - UI styling for the floating button
- **`icons/`** - Extension icons (16px, 32px, 48px, 128px)

## 🔧 Development

To **test locally** during development:

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. **Select this `src` folder**
5. Extension will be loaded for testing

## 📝 Making Changes

After editing any files:
1. Go to `chrome://extensions/`
2. Click **reload** button on the extension
3. Changes will take effect immediately

## 🏗️ Building Distribution

When ready to distribute:
1. Run build process to create distribution files
2. Files will be generated in `../dist/` folder

---
**Note:** This is the development/source version. For distribution, use files in `../dist/` folder.
