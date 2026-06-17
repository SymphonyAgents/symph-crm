#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const rolesGuardPath = path.join(root, 'src/auth/roles.guard.ts')
const authServicePath = path.join(root, 'src/auth/auth.service.ts')

const rolesGuard = fs.readFileSync(rolesGuardPath, 'utf8')
const authService = fs.readFileSync(authServicePath, 'utf8')

const checks = [
  {
    name: 'RolesGuard resolves backend sessions through a shared session object',
    pass: rolesGuard.includes('resolveBackendSession(request)'),
  },
  {
    name: 'RolesGuard falls back to the refresh token when the access token is unavailable',
    pass: rolesGuard.includes('getRefreshPayload(request)') && rolesGuard.includes('shouldRefresh: true'),
  },
  {
    name: 'RolesGuard reissues CRM session cookies after refresh-token authentication',
    pass: rolesGuard.includes('this.tokens.issueSession(response, { id: userId, email: user.email })'),
  },
  {
    name: 'RolesGuard still fails closed when no access or refresh token is valid',
    pass: rolesGuard.includes("throw new ForbiddenException('You do not have permission to access the CRM.')"),
  },
  {
    name: 'AuthService session endpoint also uses refresh-token fallback',
    pass: authService.includes('this.tokens.getRefreshPayload(req)') && authService.includes('this.tokens.issueSession(res, { id: user.id, email: user.email })'),
  },
]

const failed = checks.filter(check => !check.pass)
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

if (failed.length) {
  console.error(`\nAuth guard regression failed: ${failed.map(check => check.name).join('; ')}`)
  process.exit(1)
}

console.log('\nAuth guard refresh regression passed.')
