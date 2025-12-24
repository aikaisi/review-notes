import * as vscode from 'vscode';
import * as path from 'path';
import { Note, PRIORITY_CONFIG, CATEGORY_CONFIG, getAbsolutePath } from './utils';
import { NoteStorage } from './noteStorage';

/**
 * Tree item representing a file with notes
 */
class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly filePath: string,
        public readonly notes: Note[],
        public readonly workspaceRoot: string
    ) {
        super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);

        this.description = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
        this.tooltip = filePath;
        this.contextValue = 'noteFile';
        this.iconPath = new vscode.ThemeIcon('file');

        // Set resource URI for file icon theme
        this.resourceUri = vscode.Uri.file(getAbsolutePath(filePath, workspaceRoot));
    }
}

/**
 * Tree item representing a single note
 */
class NoteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly note: Note,
        public readonly filePath: string,
        public readonly workspaceRoot: string
    ) {
        const priorityConfig = PRIORITY_CONFIG[note.priority];
        const categoryConfig = CATEGORY_CONFIG[note.category];

        // Truncate text for display
        const displayText = note.text.length > 50
            ? note.text.substring(0, 50) + '...'
            : note.text;

        super(`${categoryConfig.icon} ${displayText}`, vscode.TreeItemCollapsibleState.None);

        this.description = `Line ${note.line + 1} ${priorityConfig.icon}`;
        this.tooltip = new vscode.MarkdownString(
            `**${categoryConfig.label}** | ${priorityConfig.label}\n\n${note.text}\n\n*${note.author} • ${new Date(note.timestamp).toLocaleString()}*`
        );
        this.contextValue = 'note';

        // Command to navigate to the note location
        this.command = {
            command: 'reviewNotes.goToNote',
            title: 'Go to Note',
            arguments: [this.note, this.filePath, this.workspaceRoot]
        };

        // Icon based on category
        this.iconPath = this.getCategoryIcon(note.category);
    }

    private getCategoryIcon(category: string): vscode.ThemeIcon {
        switch (category) {
            case 'todo': return new vscode.ThemeIcon('checklist');
            case 'bug': return new vscode.ThemeIcon('bug');
            case 'question': return new vscode.ThemeIcon('question');
            case 'idea': return new vscode.ThemeIcon('lightbulb');
            default: return new vscode.ThemeIcon('note');
        }
    }
}

type TreeItem = FileTreeItem | NoteTreeItem;

/**
 * Tree data provider for the notes explorer
 */
export class NotesTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> =
        new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private storage: NoteStorage;

    constructor(storage: NoteStorage) {
        this.storage = storage;

        // Listen for storage changes
        this.storage.onDidChange(() => this.refresh());
    }

    /**
     * Refresh the tree view
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level - return files with notes
            return Promise.resolve(this.getFileItems());
        }

        if (element instanceof FileTreeItem) {
            // File level - return notes for this file
            return Promise.resolve(this.getNoteItems(element));
        }

        return Promise.resolve([]);
    }

    /**
     * Get all files that have notes
     */
    private getFileItems(): FileTreeItem[] {
        const allNotes = this.storage.getAllNotes();
        const items: FileTreeItem[] = [];

        for (const [filePath, notes] of allNotes.entries()) {
            if (notes.length > 0) {
                items.push(new FileTreeItem(filePath, notes, this.storage.getWorkspaceRoot()));
            }
        }

        // Sort by file path
        items.sort((a, b) => a.filePath.localeCompare(b.filePath));

        return items;
    }

    /**
     * Get note items for a file
     */
    private getNoteItems(fileItem: FileTreeItem): NoteTreeItem[] {
        return fileItem.notes
            .sort((a, b) => a.line - b.line)
            .map(note => new NoteTreeItem(note, fileItem.filePath, fileItem.workspaceRoot));
    }
}

/**
 * Register tree view commands
 */
export function registerTreeViewCommands(
    context: vscode.ExtensionContext,
    storage: NoteStorage,
    provider: any  // ReviewNotesProvider (avoiding circular import)
): void {
    // Command to navigate to a note
    const goToNoteCommand = vscode.commands.registerCommand(
        'reviewNotes.goToNote',
        async (note: Note, filePath: string, workspaceRoot: string) => {
            const absolutePath = getAbsolutePath(filePath, workspaceRoot);
            const uri = vscode.Uri.file(absolutePath);

            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document);

                // Move cursor to the note's line
                const position = new vscode.Position(note.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );

                // Expand the comment thread
                if (provider && provider.expandThreadForNote) {
                    provider.expandThreadForNote(uri, note.id);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
            }
        }
    );

    // Command to delete a note from the tree view
    const deleteNoteCommand = vscode.commands.registerCommand(
        'reviewNotes.deleteNoteFromTree',
        async (treeItem: NoteTreeItem) => {
            const note = treeItem.note;
            const filePath = treeItem.filePath;
            const workspaceRoot = treeItem.workspaceRoot;

            const absolutePath = getAbsolutePath(filePath, workspaceRoot);
            const uri = vscode.Uri.file(absolutePath);

            // Delete the note from storage
            storage.deleteNote(uri, note.id);

            vscode.window.showInformationMessage(`Deleted note from ${filePath}`);
        }
    );

    context.subscriptions.push(goToNoteCommand, deleteNoteCommand);
}
