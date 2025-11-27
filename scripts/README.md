# Build Scripts

## Obfuscation Script

The `obfuscate.js` script automatically obfuscates all JavaScript files in the `js/` directory.

### Usage

```bash
# Run obfuscation manually
npm run obfuscate

# Or run directly
node scripts/obfuscate.js
```

### What it does

1. Reads all JS files from the `js/` directory
2. Applies balanced obfuscation settings
3. Overwrites original files with obfuscated versions
4. Shows file size changes

### Files Obfuscated

- `js/compiler.js`
- `js/drive-manager.js`
- `js/callback-modal.js`
- `js/course-detail.js`
- `js/floating-contact.js`

### Important Notes

⚠️ **Warning**: The obfuscation script overwrites the original files!

- Original files are kept in git
- You can restore originals with `git checkout js/*.js`
- Obfuscation runs automatically on Netlify deployment
- For local development, work with original files and restore them if needed

### Restoring Original Files

If you need to restore original (readable) files:

```bash
git checkout js/*.js
```

### Testing Obfuscated Files Locally

1. Run `npm run obfuscate`
2. Test your application
3. Restore originals: `git checkout js/*.js`
