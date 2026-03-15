import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"
import {User} from "./User.js"

const SessionSchema = defineEntity({
  name: "Session",
  properties: {
    ...BaseProperties,
    token: p.string().unique(),
    expiresAt: p.datetime(),
    ipAddress: p.string().nullable().default(null),
    userAgent: p.string().nullable().default(null),
    user: () => p.manyToOne(User)
  }
})

export class Session extends SessionSchema.class {}
SessionSchema.setClass(Session)
