import * as path from 'path';
import * as os from 'os';

/**
 * Priority levels for notes
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * Category types for notes
 */
export type Category = 'todo' | 'bug' | 'question' | 'idea' | 'note';

/**
 * Priority display configuration
 */
export const PRIORITY_CONFIG: Record<Priority, { icon: string; label: string; color: string }> = {
    high: { icon: '🔴', label: 'High', color: '#f44336' },
    medium: { icon: '🟡', label: 'Medium', color: '#ff9800' },
    low: { icon: '🟢', label: 'Low', color: '#4caf50' },
};

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<Category, { icon: string; label: string }> = {
    todo: { icon: '📋', label: 'TODO' },
    bug: { icon: '🐛', label: 'BUG' },
    question: { icon: '❓', label: 'QUESTION' },
    idea: { icon: '💡', label: 'IDEA' },
    note: { icon: '📝', label: 'NOTE' },
};

/**
 * Note interface
 */
export interface Note {
    id: string;
    line: number;
    text: string;
    timestamp: number;
    author: string;
    priority: Priority;
    category: Category;
}

/**
 * Create a default note with required fields
 */
export function createNote(
    line: number,
    text: string,
    priority: Priority = 'medium',
    category: Category = 'note'
): Note {
    return {
        id: generateId(),
        line,
        text,
        timestamp: Date.now(),
        author: getCurrentUser(),
        priority,
        category,
    };
}

/**
 * Migrate old notes to new format (backward compatibility)
 */
export function migrateNote(note: Partial<Note> & { id: string; line: number; text: string }): Note {
    return {
        id: note.id,
        line: note.line,
        text: note.text,
        timestamp: note.timestamp ?? Date.now(),
        author: note.author ?? 'Unknown',
        priority: note.priority ?? 'medium',
        category: note.category ?? 'note',
    };
}

/**
 * Normalize file path separators for cross-platform compatibility
 */
export function normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(absolutePath: string, workspaceRoot: string): string {
    const normalized = normalizeFilePath(path.relative(workspaceRoot, absolutePath));
    return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

/**
 * Get absolute path from workspace root and relative path
 */
export function getAbsolutePath(relativePath: string, workspaceRoot: string): string {
    return path.resolve(workspaceRoot, relativePath);
}

/**
 * Debounce function to delay execution
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | undefined;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
}

/**
 * Generate a unique ID for notes
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current OS username for author field
 */
export function getCurrentUser(): string {
    return os.userInfo().username || 'Unknown';
}

/**
 * Format a note for markdown display (compact single-line metadata)
 */
export function formatNoteAsMarkdown(note: Note): string {
    return note.text;
}
