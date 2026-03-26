import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

/**
 * CalendarCryptoService — AES-256-GCM encryption for OAuth refresh tokens.
 *
 * The key is 32 bytes (256 bits) from CALENDAR_ENCRYPTION_KEY env var.
 * Generate with: openssl rand -base64 32
 * Store in GCP Secret Manager as `symph-crm-calendar-encryption-key`.
 *
 * Encrypted format (base64): iv(12) || tag(16) || ciphertext
 */
@Injectable()
export class CalendarCryptoService {
  private readonly key: Buffer

  constructor(private config: ConfigService) {
    const rawKey = this.config.get<string>('CALENDAR_ENCRYPTION_KEY')
    if (!rawKey) throw new Error('CALENDAR_ENCRYPTION_KEY is required')
    this.key = Buffer.from(rawKey, 'base64')
    if (this.key.length !== 32) {
      throw new Error('CALENDAR_ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()

    // iv || tag || ciphertext — all concatenated, base64-encoded
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
  }

  decrypt(encoded: string): string {
    const data = Buffer.from(encoded, 'base64')

    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, this.key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
  }
}
