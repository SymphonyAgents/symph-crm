#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_SOURCE = '/mnt/nfs/crm'
const DEFAULT_DESTINATION = '/mnt/gcs'
const MAX_REPORTED_MISMATCHES = 20

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    destination: DEFAULT_DESTINATION,
    dryRun: false,
    verifyOnly: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--source') options.source = argv[++index]
    else if (arg === '--destination') options.destination = argv[++index]
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--verify-only') options.verifyOnly = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.source || !options.destination) {
    throw new Error('--source and --destination require non-empty paths')
  }
  if (options.dryRun && options.verifyOnly) {
    throw new Error('--dry-run and --verify-only cannot be combined')
  }

  options.source = path.resolve(options.source)
  options.destination = path.resolve(options.destination)
  const relativeDestination = path.relative(options.source, options.destination)
  const relativeSource = path.relative(options.destination, options.source)
  if (
    options.source === options.destination ||
    (!relativeDestination.startsWith('..') && !path.isAbsolute(relativeDestination)) ||
    (!relativeSource.startsWith('..') && !path.isAbsolute(relativeSource))
  ) {
    throw new Error('Source and destination must be separate, non-nested directories')
  }

  return options
}

async function sha256File(filePath) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    const input = createReadStream(filePath)
    input.on('data', chunk => hash.update(chunk))
    input.on('error', reject)
    input.on('end', resolve)
  })
  return hash.digest('hex')
}

async function collectManifest(root) {
  const rootStat = await lstat(root)
  if (!rootStat.isDirectory()) throw new Error(`Storage root is not a directory: ${root}`)

  const files = []
  async function walk(absoluteDirectory, relativeDirectory) {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const absolutePath = path.join(absoluteDirectory, entry.name)
      const relativePath = path.posix.join(relativeDirectory, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not supported: ${relativePath}`)
      }
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath)
        continue
      }
      if (!entry.isFile()) {
        throw new Error(`Unsupported filesystem entry: ${relativePath}`)
      }

      const fileStat = await lstat(absolutePath)
      files.push({
        path: relativePath,
        size: fileStat.size,
        sha256: await sha256File(absolutePath),
      })
    }
  }

  await walk(root, '')
  const bytes = files.reduce((total, file) => total + file.size, 0)
  const digest = createHash('sha256')
  for (const file of files) {
    digest.update(`${file.path}\0${file.size}\0${file.sha256}\n`)
  }

  return { root, files, bytes, digest: digest.digest('hex') }
}

function compareManifests(source, destination) {
  const sourceByPath = new Map(source.files.map(file => [file.path, file]))
  const destinationByPath = new Map(destination.files.map(file => [file.path, file]))
  const missing = []
  const changed = []
  const extra = []

  for (const [filePath, sourceFile] of sourceByPath) {
    const destinationFile = destinationByPath.get(filePath)
    if (!destinationFile) missing.push(filePath)
    else if (destinationFile.size !== sourceFile.size || destinationFile.sha256 !== sourceFile.sha256) changed.push(filePath)
  }
  for (const filePath of destinationByPath.keys()) {
    if (!sourceByPath.has(filePath)) extra.push(filePath)
  }

  return { missing, changed, extra }
}

function summary(mode, source, destination, comparison, copied = 0) {
  return {
    mode,
    source: { files: source.files.length, bytes: source.bytes, digest: source.digest },
    destination: { files: destination.files.length, bytes: destination.bytes, digest: destination.digest },
    copied,
    missing: comparison.missing.length,
    changed: comparison.changed.length,
    extra: comparison.extra.length,
    verified: comparison.missing.length === 0 && comparison.changed.length === 0 && comparison.extra.length === 0,
  }
}

function boundedMismatchDetails(comparison) {
  return {
    missing: comparison.missing.slice(0, MAX_REPORTED_MISMATCHES),
    changed: comparison.changed.slice(0, MAX_REPORTED_MISMATCHES),
    extra: comparison.extra.slice(0, MAX_REPORTED_MISMATCHES),
    truncated: {
      missing: Math.max(0, comparison.missing.length - MAX_REPORTED_MISMATCHES),
      changed: Math.max(0, comparison.changed.length - MAX_REPORTED_MISMATCHES),
      extra: Math.max(0, comparison.extra.length - MAX_REPORTED_MISMATCHES),
    },
  }
}

async function copyAndVerify(options) {
  const source = await collectManifest(options.source)
  await mkdir(options.destination, { recursive: true })
  let destination = await collectManifest(options.destination)
  let comparison = compareManifests(source, destination)

  if (options.dryRun) {
    return { summary: summary('dry-run', source, destination, comparison), comparison }
  }

  if (!options.verifyOnly) {
    const filesToCopy = new Set([...comparison.missing, ...comparison.changed])
    for (const file of source.files) {
      if (!filesToCopy.has(file.path)) continue
      const sourcePath = path.join(options.source, ...file.path.split('/'))
      const destinationPath = path.join(options.destination, ...file.path.split('/'))
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await copyFile(sourcePath, destinationPath)
      const copiedHash = await sha256File(destinationPath)
      if (copiedHash !== file.sha256) {
        throw new Error(`Copy verification failed: ${file.path}`)
      }
    }

    destination = await collectManifest(options.destination)
    comparison = compareManifests(source, destination)
    const result = summary('copy', source, destination, comparison, filesToCopy.size)
    if (!result.verified) {
      const error = new Error('Destination does not exactly match source after copy')
      error.details = boundedMismatchDetails(comparison)
      throw error
    }
    return { summary: result, comparison }
  }

  const result = summary('verify-only', source, destination, comparison)
  if (!result.verified) {
    const error = new Error('Destination does not exactly match source')
    error.details = boundedMismatchDetails(comparison)
    throw error
  }
  return { summary: result, comparison }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = await copyAndVerify(options)
    console.log(JSON.stringify(result.summary))
  } catch (error) {
    const output = {
      error: error instanceof Error ? error.message : String(error),
      details: error && typeof error === 'object' && 'details' in error ? error.details : undefined,
    }
    console.error(JSON.stringify(output))
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) await main()

export { collectManifest, compareManifests, copyAndVerify, parseArgs, sha256File }
