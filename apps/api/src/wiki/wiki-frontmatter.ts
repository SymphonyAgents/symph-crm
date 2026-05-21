const DEAL_NOTE_PATH_PATTERN = /^deals\/([^/]+)\/(general|meeting|notes|discovery|transcript|proposal)\/([^/]+\.md)$/

export function isDealNoteMarkdownPath(relativePath: string): boolean {
  return DEAL_NOTE_PATH_PATTERN.test(relativePath)
}

function hasFrontmatter(content: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---/.test(content)
}

function hasAuthorFrontmatter(content: string): boolean {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return false

  return /^authorId:\s*(?!null\s*$).+/m.test(match[1])
    || /^crm_user_id:\s*(?!null\s*$).+/m.test(match[1])
    || /^crmUserId:\s*(?!null\s*$).+/m.test(match[1])
    || /^user_id:\s*(?!null\s*$).+/m.test(match[1])
}

function serializeFrontmatterValue(value: string): string {
  return JSON.stringify(value)
}

export function ensureDealNoteAuthorFrontmatter(
  relativePath: string,
  content: string,
  authorId: string | null | undefined,
  submittedAt = new Date(),
): string {
  if (!authorId || !isDealNoteMarkdownPath(relativePath) || hasAuthorFrontmatter(content)) {
    return content
  }

  const submittedAtIso = submittedAt.toISOString()
  const attributionLines = [
    `authorId: ${authorId}`,
    `crm_user_id: ${authorId}`,
    `submitted_at: ${submittedAtIso}`,
  ]

  if (hasFrontmatter(content)) {
    return content.replace(/^---\r?\n/, `---\n${attributionLines.join('\n')}\n`)
  }

  return [
    '---',
    ...attributionLines,
    `source: ${serializeFrontmatterValue('internal_wiki_page')}`,
    '---',
    '',
    content,
  ].join('\n')
}
