import {defineEntity, p} from "@mikro-orm/sqlite"
import type {Account as BAAccount} from "better-auth"

import type {EntityShape} from "../../../utils/types.ts"
import {Base} from "./Base.ts"
import {User} from "./User.ts"

type DBAccount = Omit<BAAccount, "userId">

export const AccountSchema = defineEntity({
  name: "Account",
  extends: Base,
  properties: {
    // Added by Better Auth 1.7, which scopes account identity by issuer and
    // places a unique index on (issuer, accountId). Required, not nullable.
    issuer: p.string(),
    accountId: p.string(),
    providerId: p.string(),
    accessToken: p.string().nullable(),
    refreshToken: p.string().nullable(),
    accessTokenExpiresAt: p.datetime().nullable(),
    refreshTokenExpiresAt: p.datetime().nullable(),
    scope: p.string().nullable(),
    idToken: p.string().nullable(),
    password: p.string().nullable(),
    // Better Auth addresses this as `userId`; the adapter resolves that to the
    // owning relation, exactly as Sessions does.
    user: () => p.manyToOne(User)
  } satisfies EntityShape<DBAccount, keyof Base>,
  // Better Auth 1.7 scopes account identity by issuer and expects the database
  // to enforce it — the suite asserts that a duplicate pair is rejected.
  uniques: [
    {
      properties: ["issuer", "accountId"]
    }
  ]
})

export class Account extends AccountSchema.class implements DBAccount {}

AccountSchema.setClass(Account)
