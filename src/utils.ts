import * as path from 'path';
import * as os from 'os';


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
    // Use timestamp + random for uniqueness without external dependencies
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current OS username for author field
 */
export function getCurrentUser(): string {
    return os.userInfo().username || 'Unknown';
}

/**
 * Note interface
 */
export interface Note {
    id: string;
    line: number;
    text: string;
    timestamp: number;
    author: string;
}
