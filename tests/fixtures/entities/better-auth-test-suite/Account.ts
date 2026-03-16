import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"
import {User} from "./User.js"

const AccountSchema = defineEntity({
  name: "Account",
  properties: {
    ...BaseProperties,
    accountId: p.string(),
    providerId: p.string(),
    accessToken: p.string().nullable().default(null),
    refreshToken: p.string().nullable().default(null),
    idToken: p.string().nullable().default(null),
    accessTokenExpiresAt: p.datetime().nullable().default(null),
    refreshTokenExpiresAt: p.datetime().nullable().default(null),
    scope: p.string().nullable().default(null),
    password: p.string().nullable().default(null),
    user: () => p.manyToOne(User)
  }
})

export class Account extends AccountSchema.class {}
AccountSchema.setClass(Account)
