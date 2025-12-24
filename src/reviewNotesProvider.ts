import * as vscode from 'vscode';
import {
    Note,
    Priority,
    Category,
    PRIORITY_CONFIG,
    CATEGORY_CONFIG,
    createNote
} from './utils';
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
    public timestamp?: Date;

    constructor(
        public note: Note,
        public parent?: vscode.CommentThread
    ) {
        this.id = note.id;
        this.body = new vscode.MarkdownString(note.text);
        (this.body as vscode.MarkdownString).isTrusted = true;
        this.mode = vscode.CommentMode.Preview;
        this.contextValue = 'reviewNote';

        const priorityConfig = PRIORITY_CONFIG[note.priority];
        const categoryConfig = CATEGORY_CONFIG[note.category];

        // Show category label + priority icon only (no text)
        this.author = {
            name: `${categoryConfig.icon} ${categoryConfig.label} · ${priorityConfig.icon}`,
        };

        this.label = note.author;
        this.timestamp = new Date(note.timestamp);
    }

    /**
     * Update the comment display
     */
    public refresh(): void {
        this.body = new vscode.MarkdownString(this.note.text);
        (this.body as vscode.MarkdownString).isTrusted = true;

        const priorityConfig = PRIORITY_CONFIG[this.note.priority];
        const categoryConfig = CATEGORY_CONFIG[this.note.category];

        this.author = {
            name: `${categoryConfig.icon} ${categoryConfig.label} · ${priorityConfig.icon}`,
        };

        this.label = this.note.author;
        this.timestamp = new Date(this.note.timestamp);
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
            placeHolder: 'Type your review note here (supports Markdown)...',
            prompt: 'Add Review Note',
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

        // Command to discard an empty comment thread (cancel creation)
        const discardCommand = vscode.commands.registerCommand(
            'reviewNotes.discardNote',
            (reply: vscode.CommentReply) => {
                reply.thread.dispose();
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

        // Command to set priority
        const setPriorityHighCommand = vscode.commands.registerCommand(
            'reviewNotes.setPriorityHigh',
            (thread: vscode.CommentThread) => this.handleSetPriority(thread, 'high')
        );

        const setPriorityMediumCommand = vscode.commands.registerCommand(
            'reviewNotes.setPriorityMedium',
            (thread: vscode.CommentThread) => this.handleSetPriority(thread, 'medium')
        );

        const setPriorityLowCommand = vscode.commands.registerCommand(
            'reviewNotes.setPriorityLow',
            (thread: vscode.CommentThread) => this.handleSetPriority(thread, 'low')
        );

        // Command to set category
        const setCategoryTodoCommand = vscode.commands.registerCommand(
            'reviewNotes.setCategoryTodo',
            (thread: vscode.CommentThread) => this.handleSetCategory(thread, 'todo')
        );

        const setCategoryBugCommand = vscode.commands.registerCommand(
            'reviewNotes.setCategoryBug',
            (thread: vscode.CommentThread) => this.handleSetCategory(thread, 'bug')
        );

        const setCategoryQuestionCommand = vscode.commands.registerCommand(
            'reviewNotes.setCategoryQuestion',
            (thread: vscode.CommentThread) => this.handleSetCategory(thread, 'question')
        );

        const setCategoryIdeaCommand = vscode.commands.registerCommand(
            'reviewNotes.setCategoryIdea',
            (thread: vscode.CommentThread) => this.handleSetCategory(thread, 'idea')
        );

        const setCategoryNoteCommand = vscode.commands.registerCommand(
            'reviewNotes.setCategoryNote',
            (thread: vscode.CommentThread) => this.handleSetCategory(thread, 'note')
        );

        // Command to edit properties (category + priority) via dialog
        const editPropertiesCommand = vscode.commands.registerCommand(
            'reviewNotes.editProperties',
            (comment: ReviewComment) => this.handleEditProperties(comment)
        );

        context.subscriptions.push(
            createCommand,
            saveCommand,
            cancelCommand,
            discardCommand,
            deleteCommand,
            editCommand,
            editPropertiesCommand,
            setPriorityHighCommand,
            setPriorityMediumCommand,
            setPriorityLowCommand,
            setCategoryTodoCommand,
            setCategoryBugCommand,
            setCategoryQuestionCommand,
            setCategoryIdeaCommand,
            setCategoryNoteCommand,
            this.commentController
        );
    }

    /**
     * Handle setting priority on a note
     */
    private handleSetPriority(thread: vscode.CommentThread, priority: Priority): void {
        const noteId = (thread as any).__noteId;
        if (!noteId) return;

        this.storage.updateNotePriority(noteId, priority);

        const comment = thread.comments[0] as ReviewComment;
        if (comment) {
            comment.note.priority = priority;
            comment.refresh();

            // Set expanded state
            thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

            // Force re-render by creating new array reference
            thread.comments = thread.comments.map(c => c);
        }
    }

    /**
     * Handle setting category on a note
     */
    private handleSetCategory(thread: vscode.CommentThread, category: Category): void {
        const noteId = (thread as any).__noteId;
        if (!noteId) return;

        this.storage.updateNoteCategory(noteId, category);

        const comment = thread.comments[0] as ReviewComment;
        if (comment) {
            comment.note.category = category;
            comment.refresh();

            // Set expanded state
            thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

            // Force re-render by creating new array reference
            thread.comments = thread.comments.map(c => c);
        }
    }

    /**
     * Handle editing properties (category + priority) via two-step dialog
     */
    private async handleEditProperties(comment: ReviewComment): Promise<void> {
        if (!comment.parent) return;

        const thread = comment.parent;
        const currentCategory = comment.note.category;
        const currentPriority = comment.note.priority;

        // Step 1: Pick Category
        interface CategoryOption extends vscode.QuickPickItem {
            category: Category;
        }

        const categoryOptions: CategoryOption[] = [
            { label: '📋 TODO', description: currentCategory === 'todo' ? '$(check) Current' : '', category: 'todo', picked: currentCategory === 'todo' },
            { label: '🐛 BUG', description: currentCategory === 'bug' ? '$(check) Current' : '', category: 'bug', picked: currentCategory === 'bug' },
            { label: '❓ QUESTION', description: currentCategory === 'question' ? '$(check) Current' : '', category: 'question', picked: currentCategory === 'question' },
            { label: '💡 IDEA', description: currentCategory === 'idea' ? '$(check) Current' : '', category: 'idea', picked: currentCategory === 'idea' },
            { label: '📝 NOTE', description: currentCategory === 'note' ? '$(check) Current' : '', category: 'note', picked: currentCategory === 'note' },
        ];

        // Find the current category option to pass as default
        const defaultCategory = categoryOptions.find(opt => opt.category === currentCategory);

        const pickedCategory = await vscode.window.showQuickPick(categoryOptions, {
            placeHolder: `Current: ${defaultCategory?.label || 'Select category'}`,
            title: 'Step 1/2: Category',
        });

        if (!pickedCategory) return;

        // Step 2: Pick Priority
        interface PriorityOption extends vscode.QuickPickItem {
            priority: Priority;
        }

        const priorityOptions: PriorityOption[] = [
            { label: '🔴 High', description: currentPriority === 'high' ? '$(check) Current' : '', priority: 'high', picked: currentPriority === 'high' },
            { label: '🟡 Medium', description: currentPriority === 'medium' ? '$(check) Current' : '', priority: 'medium', picked: currentPriority === 'medium' },
            { label: '🟢 Low', description: currentPriority === 'low' ? '$(check) Current' : '', priority: 'low', picked: currentPriority === 'low' },
        ];

        // Find the current priority option
        const defaultPriority = priorityOptions.find(opt => opt.priority === currentPriority);

        const pickedPriority = await vscode.window.showQuickPick(priorityOptions, {
            placeHolder: `Current: ${defaultPriority?.label || 'Select priority'}`,
            title: 'Step 2/2: Priority',
        });

        if (!pickedPriority) return;

        // Update both category and priority
        const noteId = (thread as any).__noteId;
        if (!noteId) return;

        let needsRefresh = false;

        if (pickedCategory.category !== currentCategory) {
            this.storage.updateNoteCategory(noteId, pickedCategory.category);
            comment.note.category = pickedCategory.category;
            needsRefresh = true;
        }

        if (pickedPriority.priority !== currentPriority) {
            this.storage.updateNotePriority(noteId, pickedPriority.priority);
            comment.note.priority = pickedPriority.priority;
            needsRefresh = true;
        }

        if (needsRefresh) {
            comment.refresh();

            // Set expanded state
            thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

            // Force re-render by creating new array reference
            thread.comments = thread.comments.map(c => c);
        }
    }

    /**
     * Handle creating a new note from CommentReply
     * Uses defaults (Note category, Low priority) - users can change via context menu
     */
    private async handleCreateNote(reply: vscode.CommentReply): Promise<void> {
        const thread = reply.thread;
        const text = reply.text.trim();

        if (!text) {
            return;
        }

        // Get line number from thread range
        const line = thread.range?.start.line ?? 0;

        // Use defaults: Note category, Low priority
        // Users can change via right-click context menu
        const priority: Priority = 'low';
        const category: Category = 'note';

        // Create the note
        const note = createNote(line, text, priority, category);

        // Save to storage
        this.storage.addNote(thread.uri, note);

        // Create the comment and add to thread
        const comment = new ReviewComment(note, thread);
        thread.comments = [comment];

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

        console.log(`Review Notes: Created ${category} note with ${priority} priority on line ${note.line + 1}`);
    }

    /**
     * Handle saving an edited note
     */
    private handleSaveNote(comment: ReviewComment): void {
        if (!comment.parent) {
            return;
        }

        const thread = comment.parent;
        const noteId = comment.note.id;
        const newText = typeof comment.body === 'string'
            ? comment.body
            : comment.body.value;

        // Update storage
        this.storage.updateNote(thread.uri, noteId, newText);

        // Update the note object
        comment.note.text = newText;
        comment.note.timestamp = Date.now();

        // Refresh the comment
        comment.refresh();
        comment.mode = vscode.CommentMode.Preview;

        // Set expanded state
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;

        // Force re-render by creating new array reference (same as cancel command)
        thread.comments = thread.comments.map(c => c);

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
     * Refresh all visible threads
     */
    public refreshAllThreads(): void {
        if (vscode.window.activeTextEditor) {
            this.renderNotesForFile(vscode.window.activeTextEditor.document.uri);
        }
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
     * Expand thread for a specific note
     */
    public expandThreadForNote(uri: vscode.Uri, noteId: string): void {
        const uriKey = uri.toString();
        const threads = this.threads.get(uriKey);

        if (!threads) return;

        // Find the thread for this note
        for (const thread of threads) {
            const threadNoteId = (thread as any).__noteId;
            if (threadNoteId === noteId) {
                thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
                break;
            }
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
