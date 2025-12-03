export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function getFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').pop() || 'file';
  } catch {
    return 'file';
  }
}