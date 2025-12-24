import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Note, getRelativePath, normalizeFilePath, debounce, migrateNote, Priority, Category } from './utils';

const NOTES_FILENAME = '.notes.json';

/**
 * Storage structure: { [relativePath: string]: Note[] }
 */
export type NotesData = { [relativePath: string]: Note[] };

/**
 * Event emitter for note changes
 */
export type NoteChangeListener = () => void;

/**
 * Manages persistence of notes to .notes.json file
 */
export class NoteStorage {
    private workspaceRoot: string;
    private notesFilePath: string;
    private notes: Map<string, Note[]> = new Map();
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private saveDebounced: () => void;
    private changeListeners: NoteChangeListener[] = [];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.notesFilePath = path.join(workspaceRoot, NOTES_FILENAME);

        // Debounce saves to avoid performance issues
        this.saveDebounced = debounce(() => this.saveNow(), 500);
    }

    /**
     * Get workspace root
     */
    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    /**
     * Register a listener for note changes
     */
    public onDidChange(listener: NoteChangeListener): vscode.Disposable {
        this.changeListeners.push(listener);
        return new vscode.Disposable(() => {
            const index = this.changeListeners.indexOf(listener);
            if (index > -1) {
                this.changeListeners.splice(index, 1);
            }
        });
    }

    /**
     * Notify all change listeners
     */
    private notifyChange(): void {
        this.changeListeners.forEach(listener => listener());
    }

    /**
     * Load notes from .notes.json file
     */
    public async load(): Promise<void> {
        try {
            if (fs.existsSync(this.notesFilePath)) {
                const content = await fs.promises.readFile(this.notesFilePath, 'utf-8');
                const data: NotesData = JSON.parse(content);

                // Convert to Map and migrate old notes
                this.notes.clear();
                for (const [filePath, notes] of Object.entries(data)) {
                    // Migrate each note to ensure it has all required fields
                    const migratedNotes = notes.map(note => migrateNote(note));
                    this.notes.set(normalizeFilePath(filePath), migratedNotes);
                }

                console.log(`Review Notes: Loaded ${this.getTotalNoteCount()} notes`);
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
            vscode.window.showErrorMessage('Failed to load review notes');
        }
    }

    /**
     * Get total number of notes across all files
     */
    public getTotalNoteCount(): number {
        let count = 0;
        for (const notes of this.notes.values()) {
            count += notes.length;
        }
        return count;
    }

    /**
     * Get all notes grouped by file path
     */
    public getAllNotes(): Map<string, Note[]> {
        return new Map(this.notes);
    }

    /**
     * Get all file paths that have notes
     */
    public getFilesWithNotes(): string[] {
        return Array.from(this.notes.keys());
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
            this.notifyChange();
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
     * Get a note by ID
     */
    public getNoteById(noteId: string): { note: Note; filePath: string } | undefined {
        for (const [filePath, notes] of this.notes.entries()) {
            const note = notes.find(n => n.id === noteId);
            if (note) {
                return { note, filePath };
            }
        }
        return undefined;
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
     * Update a note's text
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
     * Update a note's priority
     */
    public updateNotePriority(noteId: string, priority: Priority): void {
        const result = this.getNoteById(noteId);
        if (result) {
            result.note.priority = priority;
            result.note.timestamp = Date.now();
            this.save();
        }
    }

    /**
     * Update a note's category
     */
    public updateNoteCategory(noteId: string, category: Category): void {
        const result = this.getNoteById(noteId);
        if (result) {
            result.note.category = category;
            result.note.timestamp = Date.now();
            this.save();
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
            this.load().then(() => {
                this.notifyChange();
                onExternalChange();
            });
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
