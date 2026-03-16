import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"

const VerificationSchema = defineEntity({
  name: "Verification",
  properties: {
    ...BaseProperties,
    identifier: p.string(),
    value: p.string(),
    expiresAt: p.datetime()
  }
})

export class Verification extends VerificationSchema.class {}
VerificationSchema.setClass(Verification)
