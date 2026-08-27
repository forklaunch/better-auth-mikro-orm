import {defineEntity, p} from "@mikro-orm/core"

import {BaseProperties} from "../shared/Base.js"

/**
 * Mirrors Better Auth's `deviceCode` model closely enough to exercise
 * `incrementOne` the way the device authorization flow does.
 *
 * The two fields that matter are `userId`, which starts null and is claimed by
 * a guarded assignment, and `attempts`, a plain counter. Having both on one
 * entity is what lets the tests cover `set` alone, `increment` alone, and the
 * two together — the third case being the one no fixture could express before,
 * since none of the shared entities had a numeric column.
 */
const DeviceCodeSchema = defineEntity({
  name: "DeviceCode",
  properties: {
    ...BaseProperties,
    userCode: p.string().unique(),
    status: p.string().default("pending"),
    userId: p.string().nullable(),
    attempts: p.integer().default(0)
  }
})

export class DeviceCode extends DeviceCodeSchema.class {}
DeviceCodeSchema.setClass(DeviceCode)
