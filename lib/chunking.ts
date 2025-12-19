// lib/chunking.ts
export function splitIntoChunks(text: string, maxWords = 2000): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim() !== '');

  if (paragraphs.length === 0) {
    // Fallback if no paragraphs
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return [];
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    const wordCount = words.length;

    if (currentWordCount + wordCount > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [para];
      currentWordCount = wordCount;
    } else {
      currentChunk.push(para);
      currentWordCount += wordCount;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}