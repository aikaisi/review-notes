import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Note, getRelativePath, normalizeFilePath, debounce } from './utils';

const NOTES_FILENAME = '.notes.json';

/**
 * Storage structure: { [relativePath: string]: Note[] }
 */
export type NotesData = { [relativePath: string]: Note[] };

/**
 * Manages persistence of notes to .notes.json file
 */
export class NoteStorage {
    private workspaceRoot: string;
    private notesFilePath: string;
    private notes: Map<string, Note[]> = new Map();
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private saveDebounced: () => void;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.notesFilePath = path.join(workspaceRoot, NOTES_FILENAME);

        // Debounce saves to avoid performance issues
        this.saveDebounced = debounce(() => this.saveNow(), 500);
    }

    /**
     * Load notes from .notes.json file
     */
    public async load(): Promise<void> {
        try {
            if (fs.existsSync(this.notesFilePath)) {
                const content = await fs.promises.readFile(this.notesFilePath, 'utf-8');
                const data: NotesData = JSON.parse(content);

                // Convert to Map
                this.notes.clear();
                for (const [filePath, notes] of Object.entries(data)) {
                    this.notes.set(normalizeFilePath(filePath), notes);
                }
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            vscode.window.showErrorMessage('Failed to load review notes');
        }
    }

    /**
     * Save notes to .notes.json file (debounced)
     */
    public save(): void {
        this.saveDebounced();
    }

    /**
     * Save notes immediately without debouncing
     */
    private async saveNow(): Promise<void> {
        try {
            // Convert Map to plain object
            const data: NotesData = {};
            for (const [filePath, notes] of this.notes.entries()) {
                if (notes.length > 0) {
                    data[filePath] = notes;
                }
            }

            const content = JSON.stringify(data, null, 2);
            await fs.promises.writeFile(this.notesFilePath, content, 'utf-8');
        } catch (error) {
            console.error('Failed to save notes:', error);
            vscode.window.showErrorMessage('Failed to save review notes');
        }
    }

    /**
     * Get notes for a specific file
     */
    public getNotesForFile(fileUri: vscode.Uri): Note[] {
        const relativePath = getRelativePath(fileUri.fsPath, this.workspaceRoot);
        return this.notes.get(normalizeFilePath(relativePath)) || [];
    }

    /**
     * Add a note to a file
     */
    public addNote(fileUri: vscode.Uri, note: Note): void {
        const relativePath = normalizeFilePath(getRelativePath(fileUri.fsPath, this.workspaceRoot));
        const fileNotes = this.notes.get(relativePath) || [];
        fileNotes.push(note);
        this.notes.set(relativePath, fileNotes);
        this.save();
    }

    /**
     * Update a note
     */
    public updateNote(fileUri: vscode.Uri, noteId: string, newText: string): void {
        const relativePath = normalizeFilePath(getRelativePath(fileUri.fsPath, this.workspaceRoot));
        const fileNotes = this.notes.get(relativePath);

        if (fileNotes) {
            const note = fileNotes.find(n => n.id === noteId);
            if (note) {
                note.text = newText;
                note.timestamp = Date.now();
                this.save();
            }
        }
    }

    /**
     * Delete a note
     */
    public deleteNote(fileUri: vscode.Uri, noteId: string): void {
        const relativePath = normalizeFilePath(getRelativePath(fileUri.fsPath, this.workspaceRoot));
        const fileNotes = this.notes.get(relativePath);

        if (fileNotes) {
            const index = fileNotes.findIndex(n => n.id === noteId);
            if (index > -1) {
                fileNotes.splice(index, 1);

                // Remove file entry if no notes left
                if (fileNotes.length === 0) {
                    this.notes.delete(relativePath);
                }

                this.save();
            }
        }
    }

    /**
     * Watch for external changes to .notes.json
     */
    public watchFile(onExternalChange: () => void): vscode.Disposable {
        const pattern = new vscode.RelativePattern(this.workspaceRoot, NOTES_FILENAME);
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidChange(() => {
            // Reload and notify
            this.load().then(() => onExternalChange());
        });

        return this.fileWatcher;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.fileWatcher?.dispose();
    }
}
