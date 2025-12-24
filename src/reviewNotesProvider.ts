import * as vscode from 'vscode';
import { Note, generateId, getCurrentUser } from './utils';
import { NoteStorage } from './noteStorage';

/**
 * Custom comment class that implements vscode.Comment
 */
class ReviewComment implements vscode.Comment {
    public id: string;
    public body: string | vscode.MarkdownString;
    public mode: vscode.CommentMode;
    public author: vscode.CommentAuthorInformation;
    public contextValue?: string;
    public label?: string;

    constructor(
        public note: Note,
        public parent?: vscode.CommentThread
    ) {
        this.id = note.id;
        this.body = new vscode.MarkdownString(note.text);
        this.mode = vscode.CommentMode.Preview;
        this.author = {
            name: note.author,
        };
        this.contextValue = 'reviewNote';

        // Format timestamp
        const date = new Date(note.timestamp);
        this.label = date.toLocaleString();
    }
}

/**
 * Manages comment threads using VS Code's Comments API
 */
export class ReviewNotesProvider {
    private commentController: vscode.CommentController;
    private threads: Map<string, vscode.CommentThread[]> = new Map();
    private storage: NoteStorage;

    constructor(
        storage: NoteStorage,
        context: vscode.ExtensionContext
    ) {
        this.storage = storage;

        // Create comment controller
        this.commentController = vscode.comments.createCommentController(
            'reviewNotes',
            'Review Notes'
        );

        // Enable commenting on all lines
        this.commentController.commentingRangeProvider = {
            provideCommentingRanges: (document: vscode.TextDocument) => {
                const lineCount = document.lineCount;
                return [new vscode.Range(0, 0, lineCount - 1, 0)];
            }
        };

        // Set up the comment controller options
        this.commentController.options = {
            placeHolder: 'Type your review note here...',
            prompt: 'Add a review note',
        };

        // Register commands for comment actions
        this.registerCommands(context);
    }

    /**
     * Register commands for comment thread actions
     */
    private registerCommands(context: vscode.ExtensionContext): void {
        // Command to create/save a new comment
        const createCommand = vscode.commands.registerCommand(
            'reviewNotes.createNote',
            (reply: vscode.CommentReply) => {
                this.handleCreateNote(reply);
            }
        );

        // Command to save an edited comment
        const saveCommand = vscode.commands.registerCommand(
            'reviewNotes.saveNote',
            (comment: ReviewComment) => {
                this.handleSaveNote(comment);
            }
        );

        // Command to cancel editing
        const cancelCommand = vscode.commands.registerCommand(
            'reviewNotes.cancelNote',
            (comment: ReviewComment) => {
                if (comment.parent) {
                    comment.mode = vscode.CommentMode.Preview;
                    comment.parent.comments = comment.parent.comments.map(c => c);
                }
            }
        );

        // Command to delete a comment thread
        const deleteCommand = vscode.commands.registerCommand(
            'reviewNotes.deleteNote',
            (thread: vscode.CommentThread) => {
                this.handleDeleteNote(thread);
            }
        );

        // Command to edit a comment
        const editCommand = vscode.commands.registerCommand(
            'reviewNotes.editNote',
            (comment: ReviewComment) => {
                if (comment.parent) {
                    comment.mode = vscode.CommentMode.Editing;
                    comment.parent.comments = comment.parent.comments.map(c => c);
                }
            }
        );

        context.subscriptions.push(
            createCommand,
            saveCommand,
            cancelCommand,
            deleteCommand,
            editCommand,
            this.commentController
        );
    }

    /**
     * Handle creating a new note from CommentReply
     */
    private handleCreateNote(reply: vscode.CommentReply): void {
        const thread = reply.thread;
        const text = reply.text.trim();

        if (!text) {
            return;
        }

        // Get line number from thread range
        const line = thread.range?.start.line ?? 0;

        // Create the note
        const note: Note = {
            id: generateId(),
            line: line,
            text: text,
            timestamp: Date.now(),
            author: getCurrentUser(),
        };

        // Save to storage
        this.storage.addNote(thread.uri, note);

        // Create the comment and add to thread
        const comment = new ReviewComment(note, thread);
        thread.comments = [...thread.comments, comment];

        // Mark thread as not collapsed so it stays visible
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

        // Store note ID on thread for deletion
        (thread as any).__noteId = note.id;

        // Track this thread
        const fileThreads = this.threads.get(thread.uri.toString()) || [];
        if (!fileThreads.includes(thread)) {
            fileThreads.push(thread);
            this.threads.set(thread.uri.toString(), fileThreads);
        }

        console.log(`Review Notes: Created note "${text}" on line ${note.line + 1}`);
    }

    /**
     * Handle saving an edited note
     */
    private handleSaveNote(comment: ReviewComment): void {
        if (!comment.parent) {
            return;
        }

        const noteId = comment.note.id;
        const newText = typeof comment.body === 'string'
            ? comment.body
            : comment.body.value;

        // Update storage
        this.storage.updateNote(comment.parent.uri, noteId, newText);

        // Update comment mode back to preview
        comment.mode = vscode.CommentMode.Preview;
        comment.parent.comments = comment.parent.comments.map(c => c);

        console.log(`Review Notes: Updated note ${noteId}`);
    }

    /**
     * Handle deleting a note
     */
    private handleDeleteNote(thread: vscode.CommentThread): void {
        const noteId = (thread as any).__noteId;

        if (noteId) {
            // Delete from storage
            this.storage.deleteNote(thread.uri, noteId);
            console.log(`Review Notes: Deleted note ${noteId}`);
        }

        // Remove from tracked threads
        const fileThreads = this.threads.get(thread.uri.toString());
        if (fileThreads) {
            const index = fileThreads.indexOf(thread);
            if (index > -1) {
                fileThreads.splice(index, 1);
            }
        }

        // Dispose the thread
        thread.dispose();
    }

    /**
     * Render notes for a file as comment threads
     */
    public renderNotesForFile(uri: vscode.Uri): void {
        // Clear existing threads for this file
        this.clearThreadsForFile(uri);

        // Get notes from storage
        const notes = this.storage.getNotesForFile(uri);

        if (notes.length === 0) {
            return;
        }

        console.log(`Review Notes: Rendering ${notes.length} notes for ${uri.fsPath}`);

        // Create threads for each note
        const threads: vscode.CommentThread[] = [];
        for (const note of notes) {
            const thread = this.createThreadFromNote(uri, note);
            threads.push(thread);
        }

        this.threads.set(uri.toString(), threads);
    }

    /**
     * Create a comment thread from an existing note
     */
    private createThreadFromNote(uri: vscode.Uri, note: Note): vscode.CommentThread {
        const range = new vscode.Range(note.line, 0, note.line, 0);
        const thread = this.commentController.createCommentThread(uri, range, []);

        const comment = new ReviewComment(note, thread);
        thread.comments = [comment];
        thread.canReply = false; // Don't allow replies, just single notes
        thread.contextValue = 'reviewNoteThread';
        thread.label = 'Review Note';
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;

        // Store note ID for deletion
        (thread as any).__noteId = note.id;

        return thread;
    }

    /**
     * Add note from context menu (alternative to + icon)
     */
    public async addNoteAtLine(uri: vscode.Uri, line: number): Promise<void> {
        // Create a new thread at the line
        const range = new vscode.Range(line, 0, line, 0);
        const thread = this.commentController.createCommentThread(uri, range, []);

        thread.canReply = true;
        thread.contextValue = 'reviewNoteThread';
        thread.label = 'Review Note';
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

        // The user will type in the comment input and press Ctrl+Enter or click submit
    }

    /**
     * Clear all threads for a file
     */
    public clearThreadsForFile(uri: vscode.Uri): void {
        const fileThreads = this.threads.get(uri.toString());
        if (fileThreads) {
            fileThreads.forEach(thread => thread.dispose());
            this.threads.delete(uri.toString());
        }
    }

    /**
     * Clear all threads
     */
    public clearAllThreads(): void {
        for (const threads of this.threads.values()) {
            threads.forEach(thread => thread.dispose());
        }
        this.threads.clear();
    }

    /**
     * Dispose the comment controller
     */
    public dispose(): void {
        this.clearAllThreads();
        this.commentController.dispose();
    }
}
