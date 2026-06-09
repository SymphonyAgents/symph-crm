import { Injectable } from '@nestjs/common'
import type { CentralGmailThread } from '../gmail/central-gmail.service'
import type { ParsedGmailMessage } from '../gmail/gmail-message-utils'

export type EmailClassification =
  | 'new_inbound_lead'
  | 'existing_deal_update'
  | 'needs_review'
  | 'internal_only'
  | 'vendor_sales'
  | 'newsletter_or_automation'
  | 'job_or_recruiting'
  | 'billing_or_admin'

export type ClassifiedEmailThread = {
  classification: EmailClassification
  confidence: 'high' | 'medium' | 'low'
  summary: string
  companyName: string | null
  companyDomain: string | null
  contactName: string | null
  contactEmail: string | null
  suggestedDealTitle: string | null
  serviceHints: string[]
  draftReplyText: string | null
  reminderReason: string | null
  reminderDays: number | null
  signals: string[]
}

const INTERNAL_DOMAINS = new Set(['symph.co'])
const AUTOMATION_SENDERS = ['no-reply', 'noreply', 'newsletter', 'updates@', 'notification', 'notifications@']
const JOB_TERMS = ['application', 'resume', 'cv', 'career', 'job opening', 'internship', 'applicant', 'hiring']
const BILLING_TERMS = ['invoice', 'receipt', 'payment failed', 'billing', 'statement of account', 'soa']
const VENDOR_TERMS = ['partnership opportunity', 'guest post', 'seo services', 'lead list', 'outsourcing offer', 'software development services']
const LEAD_TERMS = [
  'proposal',
  'pricing',
  'quote',
  'demo',
  'meeting',
  'consultation',
  'build',
  'develop',
  'automate',
  'ai agent',
  'crm',
  'website',
  'app',
  'system',
  'integration',
  'google workspace',
  'cloud',
]

function emailDomain(email: string | null | undefined): string | null {
  const domain = email?.split('@')[1]?.toLowerCase() ?? null
  if (!domain || !domain.includes('.')) return null
  return domain
}

function firstExternalMessage(thread: CentralGmailThread): ParsedGmailMessage | null {
  return thread.messages.find(message => {
    const domain = emailDomain(message.fromEmail)
    return domain ? !INTERNAL_DOMAINS.has(domain) : false
  }) ?? thread.messages[0] ?? null
}

function normalizeCompanyName(domain: string | null): string | null {
  if (!domain) return null
  const label = domain.split('.')[0]
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function compactText(thread: CentralGmailThread): string {
  return thread.messages
    .map(message => [message.subject, message.fromEmail, message.bodyText, message.snippet].filter(Boolean).join('\n'))
    .join('\n\n')
    .toLowerCase()
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term))
}

function extractSignals(text: string): string[] {
  const signals: string[] = []
  for (const term of LEAD_TERMS) {
    if (text.includes(term)) signals.push(term)
  }
  return signals.slice(0, 8)
}

function summarizeThread(thread: CentralGmailThread, contactEmail: string | null, signals: string[]): string {
  const latest = thread.messages[thread.messages.length - 1]
  const body = latest?.bodyText ?? latest?.snippet ?? thread.snippet ?? ''
  const cleaned = body.replace(/\s+/g, ' ').trim().slice(0, 500)
  const signalText = signals.length > 0 ? ` Signals: ${signals.join(', ')}.` : ''
  return `${contactEmail ?? 'Sender'} wrote about "${thread.subject}".${signalText}${cleaned ? ` Latest context: ${cleaned}` : ''}`
}

function buildDraftReply(contactName: string | null): string {
  const greeting = contactName ? `Hi ${contactName},` : 'Hi,'
  return [
    greeting,
    '',
    'Thanks for reaching out to Symph. We received your message and would be happy to learn more about what you are trying to build or improve.',
    '',
    'Could you share a few time slots that work for a quick discovery call? We can use that call to understand the goals, timeline, and the best next step.',
    '',
    'Best,',
    'Symph Team',
  ].join('\n')
}

@Injectable()
export class EmailLeadClassifierService {
  classify(thread: CentralGmailThread, knownContactDealCount = 0): ClassifiedEmailThread {
    const text = compactText(thread)
    const message = firstExternalMessage(thread)
    const contactEmail = message?.fromEmail ?? null
    const contactName = message?.fromName ?? null
    const domain = emailDomain(contactEmail)
    const companyDomain = domain && !INTERNAL_DOMAINS.has(domain) ? domain : null
    const companyName = normalizeCompanyName(companyDomain)
    const signals = extractSignals(text)

    if (thread.messages.every(item => INTERNAL_DOMAINS.has(emailDomain(item.fromEmail) ?? ''))) {
      return {
        classification: 'internal_only',
        confidence: 'high',
        summary: summarizeThread(thread, contactEmail, signals),
        companyName,
        companyDomain,
        contactName,
        contactEmail,
        suggestedDealTitle: null,
        serviceHints: [],
        draftReplyText: null,
        reminderReason: null,
        reminderDays: null,
        signals: ['all senders are internal'],
      }
    }

    if (AUTOMATION_SENDERS.some(marker => (contactEmail ?? '').includes(marker)) || includesAny(text, ['unsubscribe', 'view in browser'])) {
      return this.excluded('newsletter_or_automation', thread, contactName, contactEmail, companyName, companyDomain, signals)
    }

    if (includesAny(text, JOB_TERMS)) {
      return this.excluded('job_or_recruiting', thread, contactName, contactEmail, companyName, companyDomain, signals)
    }

    if (includesAny(text, BILLING_TERMS)) {
      return this.excluded('billing_or_admin', thread, contactName, contactEmail, companyName, companyDomain, signals)
    }

    if (includesAny(text, VENDOR_TERMS)) {
      return this.excluded('vendor_sales', thread, contactName, contactEmail, companyName, companyDomain, signals)
    }

    if (knownContactDealCount === 1) {
      return {
        classification: 'existing_deal_update',
        confidence: signals.length > 0 ? 'high' : 'medium',
        summary: summarizeThread(thread, contactEmail, signals),
        companyName,
        companyDomain,
        contactName,
        contactEmail,
        suggestedDealTitle: null,
        serviceHints: signals,
        draftReplyText: null,
        reminderReason: 'Follow up on email update from an existing CRM contact.',
        reminderDays: 2,
        signals,
      }
    }

    if (knownContactDealCount > 1) {
      return {
        classification: 'needs_review',
        confidence: 'medium',
        summary: summarizeThread(thread, contactEmail, signals),
        companyName,
        companyDomain,
        contactName,
        contactEmail,
        suggestedDealTitle: null,
        serviceHints: signals,
        draftReplyText: null,
        reminderReason: 'Multiple active deals matched this sender. Review before linking.',
        reminderDays: 1,
        signals: [...signals, 'multiple active deal matches'],
      }
    }

    if (signals.length >= 2 || includesAny(text, ['contact us', 'interested in', 'need help', 'looking for'])) {
      return {
        classification: 'new_inbound_lead',
        confidence: signals.length >= 2 ? 'high' : 'medium',
        summary: summarizeThread(thread, contactEmail, signals),
        companyName,
        companyDomain,
        contactName,
        contactEmail,
        suggestedDealTitle: companyName ? `${companyName} - Inbound inquiry` : `Inbound inquiry - ${thread.subject}`,
        serviceHints: signals,
        draftReplyText: buildDraftReply(contactName),
        reminderReason: 'Follow up on new inbound lead if no human reply is sent.',
        reminderDays: 2,
        signals,
      }
    }

    return {
      classification: 'needs_review',
      confidence: 'low',
      summary: summarizeThread(thread, contactEmail, signals),
      companyName,
      companyDomain,
      contactName,
      contactEmail,
      suggestedDealTitle: null,
      serviceHints: signals,
      draftReplyText: null,
      reminderReason: 'Review ambiguous shared-inbox email before CRM creation.',
      reminderDays: 1,
      signals,
    }
  }

  private excluded(
    classification: Exclude<EmailClassification, 'new_inbound_lead' | 'existing_deal_update' | 'needs_review' | 'internal_only'>,
    thread: CentralGmailThread,
    contactName: string | null,
    contactEmail: string | null,
    companyName: string | null,
    companyDomain: string | null,
    signals: string[],
  ): ClassifiedEmailThread {
    return {
      classification,
      confidence: 'high',
      summary: summarizeThread(thread, contactEmail, signals),
      companyName,
      companyDomain,
      contactName,
      contactEmail,
      suggestedDealTitle: null,
      serviceHints: [],
      draftReplyText: null,
      reminderReason: null,
      reminderDays: null,
      signals,
    }
  }
}
