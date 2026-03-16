import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"

const CustomUserSchema = defineEntity({
  name: "CustomUser",
  properties: {
    ...BaseProperties,
    email: p.string().unique(),
    emailVerified: p.boolean().default(false),
    name: p.string()
  }
})

export class CustomUser extends CustomUserSchema.class {}
CustomUserSchema.setClass(CustomUser)
