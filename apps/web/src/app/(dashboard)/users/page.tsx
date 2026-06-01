import { Suspense } from 'react'
import { UserManagement } from '@/components/UserManagement'

export default function UsersPage() {
  return (
    <Suspense>
      <UserManagement />
    </Suspense>
  )
}
