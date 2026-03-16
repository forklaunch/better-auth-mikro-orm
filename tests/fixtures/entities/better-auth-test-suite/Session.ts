import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"
import {User} from "./User.js"

const SessionsSchema = defineEntity({
  name: "Sessions",
  properties: {
    ...BaseProperties,
    token: p.string().unique(),
    expiresAt: p.datetime(),
    ipAddress: p.string().nullable().default(null),
    userAgent: p.string().nullable().default(null),
    user: () => p.manyToOne(User)
  }
})

export class Sessions extends SessionsSchema.class {}
SessionsSchema.setClass(Sessions)
