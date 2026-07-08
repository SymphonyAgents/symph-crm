#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const usersServicePath = path.resolve(__dirname, '../src/users/users.service.ts')
const source = fs.readFileSync(usersServicePath, 'utf8')

const requiredSalesEmails = [
  'mary.amora@symph.co',
  'gee@symph.co',
  'gee.quidet@symph.co',
  'chelle@symph.co',
  'chelle.gray@symph.co',
  'lyra.gemparo@symph.co',
  'kate.labra@symph.co',
  'frances@symph.co',
  'jarrhey@symph.co',
  'vince.tapdasan@symph.co',
  'xian.baylin@symph.co',
  'ferlie@symph.co',
  'dave@symph.co',
]

const checks = [
  {
    name: 'Default sales allowlist exists in UsersService',
    pass: source.includes('const DEFAULT_SALES_EMAILS = ['),
  },
  {
    name: 'Sales env allowlist is merged with default sales emails',
    pass: source.includes("parseEmailList(process.env.SALES_EMAILS)")
      && source.includes('split(/[;,]/)')
      && source.includes('new Set([...DEFAULT_SALES_EMAILS,'),
  },
  {
    name: 'Sales allowlist returns CrmUserRole.Sales before internal BUILD fallback',
    pass: source.indexOf('if (getSalesEmails().has(normalizedEmail)) return CrmUserRole.Sales') > -1
      && source.indexOf('if (getSalesEmails().has(normalizedEmail)) return CrmUserRole.Sales') < source.indexOf('if (isInternalEmail(normalizedEmail)) return CrmUserRole.Build'),
  },
  ...requiredSalesEmails.map(email => ({
    name: `${email} stays in SALES_EMAILS`,
    pass: source.includes(`'${email}'`),
  })),
]

const failed = checks.filter(check => !check.pass)
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

if (failed.length) {
  console.error(`\nUsers role regression failed: ${failed.map(check => check.name).join('; ')}`)
  process.exit(1)
}

console.log('\nUsers role regression passed.')
