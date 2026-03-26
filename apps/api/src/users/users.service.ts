import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private db: Database) {}

  /**
   * Upsert a user from NextAuth signIn callback.
   * Called once per login — keeps public.users in sync with Google OAuth identity.
   * id = NextAuth user.id (Google OAuth sub claim)
   */
  async sync(data: { id: string; email: string; name?: string | null; image?: string | null }) {
    const [user] = await this.db
      .insert(users)
      .values({
        id: data.id,
        email: data.email,
        name: data.name ?? null,
        image: data.image ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          name: data.name ?? null,
          image: data.image ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    return user
  }

  async findOne(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id))
    return user ?? null
  }

  async findAll() {
    return this.db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
    }).from(users)
  }
}
