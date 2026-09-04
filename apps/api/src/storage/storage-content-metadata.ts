export function extractExcerpt(content: string): { excerpt: string; wordCount: number } {
  const stripped = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .trim()
  const excerpt = stripped.slice(0, 500)
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return { excerpt, wordCount }
}

export function extractHtmlExcerpt(html: string): { excerpt: string; wordCount: number } {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  const excerpt = text.slice(0, 500)
  const wordCount = text.split(/\s+/).filter(Boolean).length
  return { excerpt, wordCount }
}
