import {defineEntity, p} from "@mikro-orm/sqlite"

import {Base} from "../shared/Base.ts"

/**
 * Mirrors Better Auth's `deviceCode` model closely enough to exercise
 * `incrementOne` the way the device authorization flow does.
 *
 * The two fields that matter are `userId`, which starts null and is claimed by
 * a guarded assignment, and `attempts`, a plain counter. Having both on one
 * entity is what lets the tests cover `set` alone, `increment` alone, and the
 * two together — the third case being one no other fixture could express, since
 * none of them carries a numeric column.
 *
 * `userId` is a plain string rather than a relation on purpose: these tests are
 * about the write mechanics of the guarded update, and a `manyToOne` would drag
 * in a User fixture and its own persistence rules for no benefit here.
 */
const DeviceCodeSchema = defineEntity({
  name: "DeviceCode",
  extends: Base,
  properties: {
    userCode: p.string().unique(),
    status: p.string().default("pending"),
    userId: p.string().nullable(),
    attempts: p.integer().default(0)
  }
})

export class DeviceCode extends DeviceCodeSchema.class {}

DeviceCodeSchema.setClass(DeviceCode)
