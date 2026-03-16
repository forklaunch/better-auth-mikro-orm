import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"
import {Address} from "./Address.js"
import {Session} from "./Session.js"

const UserSchema = defineEntity({
  name: "User",
  properties: {
    ...BaseProperties,
    email: p.string().unique(),
    emailVerified: p.boolean().default(false),
    name: p.string(),
    sessions: () => p.oneToMany(Session).mappedBy(s => s.user),
    address: () => p.embedded(Address).object().nullable()
  }
})

export class User extends UserSchema.class {}
UserSchema.setClass(User)
