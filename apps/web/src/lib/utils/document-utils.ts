/**
 * Document utility functions for file type badges, word count filtering, and content display.
 */

// ── MIME Type to Label Mapping ────────────────────────────────────────────────
// Maps both full MIME types and file extensions to display labels (max 4 chars)

const MIME_TO_LABEL: Record<string, string> = {
  // Microsoft Office Open XML formats
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',

  // Legacy Microsoft Office formats
  'application/msword': 'DOC',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.ms-powerpoint': 'PPT',

  // PDF
  'application/pdf': 'PDF',

  // Text formats
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/html': 'HTML',
  'text/csv': 'CSV',

  // Images
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',


  // Audio
  'audio/mp4': 'M4A',
  'audio/x-m4a': 'M4A',
  'audio/mpeg': 'MP3',

  // Archives
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
  'application/x-rar-compressed': 'RAR',
  'application/x-7z-compressed': '7Z',

  // Other common formats
  'application/vnd.google-earth.kml+xml': 'KML',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'application/x-yaml': 'YAML',
}

// Shorthand mappings for file extensions (already uppercase)
const EXT_TO_LABEL: Record<string, string> = {
  docx: 'DOCX',
  doc: 'DOC',
  xlsx: 'XLSX',
  xls: 'XLS',
  pptx: 'PPTX',
  ppt: 'PPT',
  pdf: 'PDF',
  txt: 'TXT',
  md: 'MD',
  html: 'HTML',
  csv: 'CSV',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  gif: 'GIF',
  svg: 'SVG',
  mp4: 'M4A',
  m4a: 'M4A',
  mp3: 'MP3',
  mpeg: 'MP3',
  zip: 'ZIP',
  rar: 'RAR',
  '7z': '7Z',
  kml: 'KML',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
}

/**
 * Convert MIME type or file extension to a display label.
 * Handles both full MIME types and simple extensions.
 * Falls back to extracting extension from filename.
 * Returns max 4 characters.
 *
 * @param mimeOrExt - MIME type string or file extension
 * @param filename - Optional filename to extract extension from as last resort
 * @returns Display label (e.g., "DOCX", "PNG", "FILE")
 */
export function getMimeLabel(mimeOrExt: string | null | undefined, filename?: string): string {
  if (!mimeOrExt) {
    // No MIME/ext provided; try to extract from filename
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase()
      if (ext && ext.length > 0 && ext.length <= 4) {
        return EXT_TO_LABEL[ext] || ext.toUpperCase()
      }
    }
    return 'FILE'
  }

  const normalized = mimeOrExt.toLowerCase().trim()

  // Try MIME type lookup first
  if (normalized.includes('/')) {
    const label = MIME_TO_LABEL[normalized]
    if (label) return label
  }

  // Try extension lookup (handles simple extensions like 'docx', 'pdf')
  const label = EXT_TO_LABEL[normalized]
  if (label) return label

  // If it's a simple string (no slashes), assume it's an extension
  if (!normalized.includes('/') && normalized.length > 0 && normalized.length <= 4) {
    return normalized.toUpperCase()
  }

  // Last resort: try to extract from filename
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext && ext.length > 0 && ext.length <= 4) {
      return EXT_TO_LABEL[ext] || ext.toUpperCase()
    }
  }

  // Fallback
  return 'FILE'
}

// ── Document Type Filtering ────────────────────────────────────────────────────

const TEXT_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'application/x-yaml',
  'text/yaml',
])

const TEXT_DOCUMENT_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'md', 'html', 'htm', 'csv', 'json', 'xml', 'yaml', 'yml',
])

const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
])

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'])
const AUDIO_MIMES = new Set([
  'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/mp3',
])

const AUDIO_EXTS = new Set(['mp4', 'x-m4a', 'mpeg', 'mp3', 'm4a'])


/**
 * Determine if a document type supports word count.
 * Only text-based documents (PDF, DOCX, XLSX, etc.) have meaningful word counts.
 * Images, videos, archives, etc. do not.
 *
 * @param mimeOrExt - MIME type or file extension
 * @returns true if word count is meaningful for this document type
 */
export function supportsWordCount(mimeOrExt: string | null | undefined): boolean {
  if (!mimeOrExt) return false

  const normalized = mimeOrExt.toLowerCase().trim()

  // Check MIME type
  if (normalized.includes('/')) {
    return TEXT_DOCUMENT_MIMES.has(normalized)
  }

  // Check extension
  return TEXT_DOCUMENT_EXTS.has(normalized)
}

/**
 * Determine if a document is an image.
 *
 * @param mimeOrExt - MIME type or file extension
 * @returns true if this is an image document
 */
export function isImage(mimeOrExt: string | null | undefined): boolean {
  if (!mimeOrExt) return false

  const normalized = mimeOrExt.toLowerCase().trim()

  // Check MIME type
  if (normalized.includes('/')) {
    return IMAGE_MIMES.has(normalized) || normalized.startsWith('image/')
  }

  // Check extension
  return IMAGE_EXTS.has(normalized)
}
/**
 * Determine if a document is an audio file.
 *
 * @param mimeOrExt - MIME type or file extension
 * @returns true if this is an audio document
 */
export function isAudio(mimeOrExt: string | null | undefined): boolean {
  if (!mimeOrExt) return false

  const normalized = mimeOrExt.toLowerCase().trim()

  // Check MIME type
  if (normalized.includes('/')) {
    return AUDIO_MIMES.has(normalized) || normalized.startsWith('audio/')
  }

  // Check extension
  return AUDIO_EXTS.has(normalized)
}
