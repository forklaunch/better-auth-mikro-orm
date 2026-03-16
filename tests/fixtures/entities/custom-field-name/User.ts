import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"

const UserSchema = defineEntity({
  name: "User",
  properties: {
    ...BaseProperties,
    emailAddress: p.string().unique(),
    emailVerified: p.boolean().default(false),
    name: p.string()
  }
})

export class User extends UserSchema.class {}
UserSchema.setClass(User)
