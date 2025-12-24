# Review Notes

> Add local code review notes to your files without modifying source code. Mimics the MS Word Comments or Bitbucket Code Review experience directly in VS Code.

## Features

- **Native Comment Threads**: Uses VS Code's built-in Comments API for an authentic PR-style review experience
- **Local Storage**: All notes are saved to `.notes.json` in your workspace root
- **No Source Code Changes**: Notes are stored separately and never modify your actual code files
- **Multi-Root Workspace Support**: Each workspace folder has its own `.notes.json` file
- **Real-time Sync**: File watching detects external changes to `.notes.json`
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Usage

### Adding a Note

1. Right-click on any line in your code
2. Select **"Add Review Note"** from the context menu
3. Enter your note text in the input box
4. The note appears as a comment thread in the gutter

### Editing a Note

- Click on the comment thread to view the note
- Use the reply functionality to update the note text

### Deleting a Note

- Click the delete icon on the comment thread
- Or use the "Delete Review Note" command from the thread context menu

## Data Storage

All notes are stored in a `.notes.json` file at the root of your workspace:

```json
{
  "./src/example.ts": [
    {
      "id": "1234567890-abc123",
      "line": 42,
      "text": "This function needs optimization",
      "timestamp": 1703376000000,
      "author": "username"
    }
  ]
}
```

### Sharing Notes

- **Private notes**: Add `.notes.json` to your `.gitignore`
- **Team notes**: Commit `.notes.json` to share notes with your team

## Requirements

- VS Code 1.85.0 or higher

## Installation

### From VSIX

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions view (Cmd+Shift+X / Ctrl+Shift+X)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded file

### From Source

```bash
# Clone or download the extension
cd review-notes

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension (optional)
npm install -g @vscode/vsce
vsce package
```

## Development

### Running in Development Mode

1. Open the extension folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open a workspace in the development host
4. Test the extension features

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Package for distribution
vsce package
```

## FAQ

**Q: Can I use this with Git?**  
A: Yes! You can either commit `.notes.json` to share notes with your team, or add it to `.gitignore` to keep notes private.

**Q: What happens if I move or rename a file?**  
A: Notes are stored by file path, so you'll need to manually update the path in `.notes.json` if you move/rename files.

**Q: Can I export notes to a report?**  
A: Currently, notes are stored in JSON format. You can manually parse `.notes.json` to create custom reports.

**Q: Does this work with multi-root workspaces?**  
A: Yes! Each workspace folder gets its own `.notes.json` file.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
