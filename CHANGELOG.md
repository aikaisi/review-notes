# Change Log

All notable changes to the "Review Notes" extension will be documented in this file.

## [0.2.0] - 2024-12-24

### Added
- **Note Editing**: Edit note text directly via the pencil icon
- **Sidebar Actions**: Delete notes directly from the Review Notes Explorer sidebar
- **Priority Levels**: Set priority (🔴 High, 🟡 Medium, 🟢 Low)
- **Note Categories**: Choose from TODO, 🐛 BUG, ❓ QUESTION, 💡 IDEA, or 📝 NOTE
- **Advanced UI**: Clean comment headers showing only icons and metadata
- **Markdown Support**: Notes render with full Markdown formatting
- **Keyboard Shortcut**: `Ctrl+Shift+N` (Mac: `Cmd+Shift+N`)
- **Navigation**: Click notes in sidebar to auto-navigate and expand the thread
- **Export**: Generate Markdown `[ ]` or HTML `[ ]` reports
- **Context Menus**: Comprehensive menus for adding, editing, and deleting notes

### Improved
- **Property Editing**: Two-step QuickPick for easier Category & Priority selection
- **Creation Flow**: Added "Discard" button to cancel note creation easily
- **Visuals**: refined icons and better spacing in comment threads

### Changed
- Notes now display with category icons and priority badges
- Improved note formatting with author and timestamp display

### Fixed
- Backward compatibility with v0.1.0 `.notes.json` files

## [0.1.0] - 2024-12-24

### Added
- Initial release
- Add review notes to any line of code via right-click context menu or gutter + icon
- Notes appear as native VS Code comment threads
- All notes stored locally in `.notes.json` at workspace root
- Multi-root workspace support
- File watching for external changes to `.notes.json`
- Delete notes via comment thread menu
- Cross-platform support (Windows, macOS, Linux)
