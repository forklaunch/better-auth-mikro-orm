import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"
import {Address} from "./Address.js"
import {Sessions} from "./Session.js"

const UserSchema = defineEntity({
  name: "User",
  properties: {
    ...BaseProperties,
    email_address: p.string().unique(),
    emailVerified: p.boolean().default(false),
    test: p.string().nullable(),
    name: p.string(),
    sessions: () => p.oneToMany(Sessions).mappedBy(s => s.user),
    address: () => p.embedded(Address).object().nullable()
  }
})

export class User extends UserSchema.class {}
UserSchema.setClass(User)
