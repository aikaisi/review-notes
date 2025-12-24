import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PRIORITY_CONFIG, CATEGORY_CONFIG } from './utils';
import { NoteStorage } from './noteStorage';

/**
 * Export notes to Markdown format
 */
export async function exportToMarkdown(storage: NoteStorage): Promise<void> {
    const allNotes = storage.getAllNotes();

    if (allNotes.size === 0) {
        vscode.window.showWarningMessage('No notes to export');
        return;
    }

    const workspaceRoot = storage.getWorkspaceRoot();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `review-notes-${timestamp}.md`;

    // Ask for save location
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceRoot, defaultFilename)),
        filters: { 'Markdown': ['md'] }
    });

    if (!saveUri) {
        return;
    }

    // Generate markdown content
    let markdown = `# Review Notes Report\n\n`;
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += `Total Notes: ${storage.getTotalNoteCount()}\n\n`;
    markdown += `---\n\n`;

    // Group by priority for summary
    const summary = { high: 0, medium: 0, low: 0 };
    const categories = { todo: 0, bug: 0, question: 0, idea: 0, note: 0 };

    for (const notes of allNotes.values()) {
        for (const note of notes) {
            summary[note.priority]++;
            categories[note.category]++;
        }
    }

    markdown += `## Summary\n\n`;
    markdown += `| Priority | Count |\n|----------|-------|\n`;
    markdown += `| 🔴 High | ${summary.high} |\n`;
    markdown += `| 🟡 Medium | ${summary.medium} |\n`;
    markdown += `| 🟢 Low | ${summary.low} |\n\n`;

    markdown += `| Category | Count |\n|----------|-------|\n`;
    markdown += `| 📋 TODO | ${categories.todo} |\n`;
    markdown += `| 🐛 BUG | ${categories.bug} |\n`;
    markdown += `| ❓ QUESTION | ${categories.question} |\n`;
    markdown += `| 💡 IDEA | ${categories.idea} |\n`;
    markdown += `| 📝 NOTE | ${categories.note} |\n\n`;

    markdown += `---\n\n`;
    markdown += `## Notes by File\n\n`;

    // Sort files alphabetically
    const sortedFiles = Array.from(allNotes.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [filePath, notes] of sortedFiles) {
        if (notes.length === 0) continue;

        markdown += `### ${filePath}\n\n`;

        // Sort notes by line number
        const sortedNotes = [...notes].sort((a, b) => a.line - b.line);

        for (const note of sortedNotes) {
            const priorityConfig = PRIORITY_CONFIG[note.priority];
            const categoryConfig = CATEGORY_CONFIG[note.category];
            const date = new Date(note.timestamp).toLocaleString();

            markdown += `#### Line ${note.line + 1} - ${categoryConfig.icon} ${categoryConfig.label} ${priorityConfig.icon}\n\n`;
            markdown += `${note.text}\n\n`;
            markdown += `> *${note.author} • ${date}*\n\n`;
        }

        markdown += `---\n\n`;
    }

    // Write file
    await fs.promises.writeFile(saveUri.fsPath, markdown, 'utf-8');

    // Open the file
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`Exported ${storage.getTotalNoteCount()} notes to Markdown`);
}

/**
 * Export notes to HTML format
 */
export async function exportToHtml(storage: NoteStorage): Promise<void> {
    const allNotes = storage.getAllNotes();

    if (allNotes.size === 0) {
        vscode.window.showWarningMessage('No notes to export');
        return;
    }

    const workspaceRoot = storage.getWorkspaceRoot();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `review-notes-${timestamp}.html`;

    // Ask for save location
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceRoot, defaultFilename)),
        filters: { 'HTML': ['html'] }
    });

    if (!saveUri) {
        return;
    }

    // Count totals
    const summary = { high: 0, medium: 0, low: 0 };
    const categories = { todo: 0, bug: 0, question: 0, idea: 0, note: 0 };

    for (const notes of allNotes.values()) {
        for (const note of notes) {
            summary[note.priority]++;
            categories[note.category]++;
        }
    }

    // Generate HTML content
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Notes Report</title>
    <style>
        :root {
            --bg-color: #1e1e2e;
            --text-color: #cdd6f4;
            --card-bg: #313244;
            --border-color: #45475a;
            --high-color: #f38ba8;
            --medium-color: #fab387;
            --low-color: #a6e3a1;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            padding: 2rem;
        }
        
        .container { max-width: 900px; margin: 0 auto; }
        
        h1 { 
            color: #cba6f7;
            margin-bottom: 0.5rem;
            font-size: 2rem;
        }
        
        .meta { 
            color: #a6adc8;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .summary-card {
            background: var(--card-bg);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
        }
        
        .summary-card .count {
            font-size: 2rem;
            font-weight: bold;
        }
        
        .summary-card.high .count { color: var(--high-color); }
        .summary-card.medium .count { color: var(--medium-color); }
        .summary-card.low .count { color: var(--low-color); }
        
        .file-section {
            background: var(--card-bg);
            border-radius: 8px;
            margin-bottom: 1.5rem;
            overflow: hidden;
        }
        
        .file-header {
            background: #45475a;
            padding: 0.75rem 1rem;
            font-family: monospace;
            font-size: 0.9rem;
        }
        
        .note {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
        }
        
        .note:last-child { border-bottom: none; }
        
        .note-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .note-meta {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        
        .badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .badge.high { background: var(--high-color); color: #1e1e2e; }
        .badge.medium { background: var(--medium-color); color: #1e1e2e; }
        .badge.low { background: var(--low-color); color: #1e1e2e; }
        
        .category { font-size: 1.2rem; }
        
        .note-text {
            background: #1e1e2e;
            padding: 1rem;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: inherit;
        }
        
        .note-footer {
            margin-top: 0.5rem;
            font-size: 0.8rem;
            color: #a6adc8;
        }
        
        .line-badge {
            background: #89b4fa;
            color: #1e1e2e;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Review Notes Report</h1>
        <p class="meta">Generated: ${new Date().toLocaleString()} | Total: ${storage.getTotalNoteCount()} notes</p>
        
        <div class="summary">
            <div class="summary-card high">
                <div class="count">${summary.high}</div>
                <div>🔴 High Priority</div>
            </div>
            <div class="summary-card medium">
                <div class="count">${summary.medium}</div>
                <div>🟡 Medium Priority</div>
            </div>
            <div class="summary-card low">
                <div class="count">${summary.low}</div>
                <div>🟢 Low Priority</div>
            </div>
        </div>
`;

    // Sort files alphabetically
    const sortedFiles = Array.from(allNotes.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [filePath, notes] of sortedFiles) {
        if (notes.length === 0) continue;

        html += `
        <div class="file-section">
            <div class="file-header">📁 ${filePath}</div>
`;

        // Sort notes by line number
        const sortedNotes = [...notes].sort((a, b) => a.line - b.line);

        for (const note of sortedNotes) {
            const priorityConfig = PRIORITY_CONFIG[note.priority];
            const categoryConfig = CATEGORY_CONFIG[note.category];
            const date = new Date(note.timestamp).toLocaleString();

            html += `
            <div class="note">
                <div class="note-header">
                    <div class="note-meta">
                        <span class="category">${categoryConfig.icon}</span>
                        <span>${categoryConfig.label}</span>
                        <span class="line-badge">Line ${note.line + 1}</span>
                    </div>
                    <span class="badge ${note.priority}">${priorityConfig.icon} ${priorityConfig.label}</span>
                </div>
                <div class="note-text">${escapeHtml(note.text)}</div>
                <div class="note-footer">${note.author} • ${date}</div>
            </div>
`;
        }

        html += `        </div>\n`;
    }

    html += `
    </div>
</body>
</html>`;

    // Write file
    await fs.promises.writeFile(saveUri.fsPath, html, 'utf-8');

    // Open in browser
    await vscode.env.openExternal(saveUri);

    vscode.window.showInformationMessage(`Exported ${storage.getTotalNoteCount()} notes to HTML`);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Register export commands
 */
export function registerExportCommands(
    context: vscode.ExtensionContext,
    storage: NoteStorage
): void {
    const exportMdCommand = vscode.commands.registerCommand(
        'reviewNotes.exportMarkdown',
        () => exportToMarkdown(storage)
    );

    const exportHtmlCommand = vscode.commands.registerCommand(
        'reviewNotes.exportHtml',
        () => exportToHtml(storage)
    );

    context.subscriptions.push(exportMdCommand, exportHtmlCommand);
}
