import * as vscode from 'vscode';
import { NoteStorage } from './noteStorage';
import { ReviewNotesProvider } from './reviewNotesProvider';
import { NotesTreeProvider, registerTreeViewCommands } from './notesTreeProvider';
import { registerExportCommands } from './exportProvider';
import { WorkspaceManager, getCurrentWorkspaceRoot } from './workspaceManager';

let storage: NoteStorage | undefined;
let provider: ReviewNotesProvider | undefined;
let workspaceManager: WorkspaceManager | undefined;
let treeProvider: NotesTreeProvider | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Review Notes: Extension is activating...');

    // Get workspace root
    const workspaceRoot = getCurrentWorkspaceRoot();
    if (!workspaceRoot) {
        console.log('Review Notes: No workspace folder open');
        vscode.window.showWarningMessage('Review Notes: No workspace folder open');
        return;
    }

    console.log(`Review Notes: Workspace root is ${workspaceRoot}`);

    // Initialize storage
    storage = new NoteStorage(workspaceRoot);
    await storage.load();
    console.log('Review Notes: Storage loaded');

    // Initialize provider (pass context for command registration)
    provider = new ReviewNotesProvider(storage, context);
    console.log('Review Notes: Provider initialized');

    // Initialize tree view
    treeProvider = new NotesTreeProvider(storage);
    const treeView = vscode.window.createTreeView('reviewNotesExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    console.log('Review Notes: Tree view initialized');

    // Initialize workspace manager
    workspaceManager = new WorkspaceManager();

    // Register main commands
    registerMainCommands(context);

    // Register tree view commands
    registerTreeViewCommands(context, storage, provider);

    // Register export commands
    registerExportCommands(context, storage);

    // Set up event listeners
    setupEventListeners(context);

    // Render notes for currently active editor
    if (vscode.window.activeTextEditor) {
        provider.renderNotesForFile(vscode.window.activeTextEditor.document.uri);
    }

    console.log('Review Notes: Extension activated successfully');
}

/**
 * Register main extension commands
 */
function registerMainCommands(context: vscode.ExtensionContext) {
    // Add note command (context menu and keyboard shortcut)
    const addNoteCommand = vscode.commands.registerCommand('reviewNotes.addNote', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !provider) {
            return;
        }

        const line = editor.selection.active.line;
        await provider.addNoteAtLine(editor.document.uri, line);
    });

    // Refresh tree view command
    const refreshCommand = vscode.commands.registerCommand('reviewNotes.refreshTree', () => {
        if (treeProvider) {
            treeProvider.refresh();
        }
    });

    context.subscriptions.push(addNoteCommand, refreshCommand);
}

/**
 * Set up event listeners
 */
function setupEventListeners(context: vscode.ExtensionContext) {
    if (!storage || !provider || !workspaceManager) {
        return;
    }

    // Watch for active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && provider) {
            console.log(`Review Notes: Active editor changed to ${editor.document.uri.fsPath}`);
            provider.renderNotesForFile(editor.document.uri);
        }
    });

    // Watch for workspace changes
    const workspaceChangeListener = workspaceManager.onChange(async (newRoot) => {
        if (newRoot && storage && provider) {
            console.log(`Review Notes: Workspace changed to ${newRoot}`);

            // Dispose old storage
            storage.dispose();
            provider.clearAllThreads();

            // Create new storage for new workspace
            storage = new NoteStorage(newRoot);
            await storage.load();

            // Update tree provider
            if (treeProvider) {
                treeProvider = new NotesTreeProvider(storage);
            }

            // Render notes for active editor
            if (vscode.window.activeTextEditor) {
                provider.renderNotesForFile(vscode.window.activeTextEditor.document.uri);
            }
        }
    });

    // Watch for external file changes
    const fileWatcherDisposable = storage.watchFile(() => {
        console.log('Review Notes: .notes.json changed externally');
        // Reload notes for active editor when .notes.json changes externally
        if (vscode.window.activeTextEditor && provider) {
            provider.renderNotesForFile(vscode.window.activeTextEditor.document.uri);
        }
        // Refresh tree view
        if (treeProvider) {
            treeProvider.refresh();
        }
    });

    context.subscriptions.push(
        editorChangeListener,
        workspaceChangeListener,
        fileWatcherDisposable
    );
}

/**
 * Extension deactivation
 */
export function deactivate() {
    console.log('Review Notes: Deactivating...');
    if (provider) {
        provider.dispose();
    }
    if (storage) {
        storage.dispose();
    }
    console.log('Review Notes: Deactivated');
}
