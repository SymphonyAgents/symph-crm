export function getProposalTitleFromUploadFile(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Uploaded proposal'
}

export function isHtmlProposalFile(file: File | null) {
  if (!file) return false
  const name = file.name.toLowerCase()
  return file.type === 'text/html' || name.endsWith('.html') || name.endsWith('.htm')
}
