import * as vscode from 'vscode';
import { NoteStorage } from './noteStorage';
import { ReviewNotesProvider } from './reviewNotesProvider';
import { WorkspaceManager, getCurrentWorkspaceRoot } from './workspaceManager';

let storage: NoteStorage | undefined;
let provider: ReviewNotesProvider | undefined;
let workspaceManager: WorkspaceManager | undefined;

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

    // Initialize workspace manager
    workspaceManager = new WorkspaceManager();

    // Register add note command (context menu)
    const addNoteCommand = vscode.commands.registerCommand('reviewNotes.addNote', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !provider) {
            return;
        }

        const line = editor.selection.active.line;
        await provider.addNoteAtLine(editor.document.uri, line);
    });

    context.subscriptions.push(addNoteCommand);

    // Set up event listeners
    setupEventListeners(context);

    // Render notes for currently active editor
    if (vscode.window.activeTextEditor) {
        provider.renderNotesForFile(vscode.window.activeTextEditor.document.uri);
    }

    console.log('Review Notes: Extension activated successfully');
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

            // Dispose old storage and provider
            storage.dispose();
            provider.clearAllThreads();

            // Create new storage for new workspace
            storage = new NoteStorage(newRoot);
            await storage.load();

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
