import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the workspace root for a given URI
 */
export function getWorkspaceRoot(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
}

/**
 * Get the workspace root for the currently active editor
 */
export function getCurrentWorkspaceRoot(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        // Fallback to first workspace folder
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    return getWorkspaceRoot(activeEditor.document.uri);
}

/**
 * Watch for workspace changes and notify when switching between workspace folders
 */
export class WorkspaceManager {
    private currentWorkspaceRoot: string | undefined;
    private onChangeCallbacks: ((newRoot: string | undefined) => void)[] = [];

    constructor() {
        this.currentWorkspaceRoot = getCurrentWorkspaceRoot();

        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const newRoot = getWorkspaceRoot(editor.document.uri);

                // Only notify if workspace actually changed
                if (newRoot !== this.currentWorkspaceRoot) {
                    this.currentWorkspaceRoot = newRoot;
                    this.notifyChange(newRoot);
                }
            }
        });
    }

    /**
     * Register a callback for workspace changes
     */
    public onChange(callback: (newRoot: string | undefined) => void): vscode.Disposable {
        this.onChangeCallbacks.push(callback);

        return new vscode.Disposable(() => {
            const index = this.onChangeCallbacks.indexOf(callback);
            if (index > -1) {
                this.onChangeCallbacks.splice(index, 1);
            }
        });
    }

    /**
     * Get the current workspace root
     */
    public getWorkspaceRoot(): string | undefined {
        return this.currentWorkspaceRoot;
    }

    private notifyChange(newRoot: string | undefined): void {
        for (const callback of this.onChangeCallbacks) {
            callback(newRoot);
        }
    }
}
