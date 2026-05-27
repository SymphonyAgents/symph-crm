import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'

const HTML_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export function validateProposalHtmlDocument(html: string) {
  if (!html?.trim()) throw new BadRequestException('html is required')

  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > HTML_MAX_BYTES) {
    throw new PayloadTooLargeException(
      `Proposal HTML is ${(bytes / 1024 / 1024).toFixed(2)}MB; cap is ${HTML_MAX_BYTES / 1024 / 1024}MB. ` +
      `Move embedded images/videos to Supabase Storage and reference by URL.`,
    )
  }

  const checks = [
    {
      label: 'A4 page wrappers',
      ok: /class=["'][^"']*\bpage\b/i.test(html),
    },
    {
      label: 'canonical print media block',
      ok: /@media\s+print/i.test(html),
    },
    {
      label: 'A4 print page size',
      ok: /@page\s*{[^}]*size\s*:\s*A4/i.test(html),
    },
    {
      label: 'print color adjustment',
      ok: /print-color-adjust\s*:\s*exact/i.test(html),
    },
    {
      label: 'proposal page breaks',
      ok: /(page-break-after|break-after)\s*:\s*(always|page)/i.test(html),
    },
  ]

  const missing = checks.filter(check => !check.ok).map(check => check.label)
  if (missing.length > 0) {
    throw new BadRequestException(
      `Proposal HTML failed quality gate. Missing: ${missing.join(', ')}. ` +
      'Regenerate through proposal-builder before saving to CRM.',
    )
  }
}
