import {defineEntity, p, Type} from "@mikro-orm/sqlite"

import {Base} from "../shared/Base.ts"

/**
 * Stands in for a `@forklaunch/core` compliant field: the column loads as a
 * branded object whose value is reachable only through `.deanon`, and which
 * serializes as `{}`. The adapter must hand Better Auth the value, not `{}`.
 */
const COMPLIANT_FIELD = Symbol.for("forklaunch.compliance.field")

function sealed(value: string) {
  const field = Object.create(null, {
    [COMPLIANT_FIELD]: {value: true},
    deanon: {get: () => value}
  })
  return Object.freeze(field)
}

class SealedType extends Type<unknown, string> {
  override convertToDatabaseValue(value: unknown): string {
    if (value && typeof value === "object" && COMPLIANT_FIELD in value) {
      return `sealed:${(value as {deanon: string}).deanon}`
    }
    return `sealed:${String(value)}`
  }

  override convertToJSValue(value: string): unknown {
    return sealed(value.replace(/^sealed:/, ""))
  }

  override getColumnType(): string {
    return "text"
  }
}

const SealedSecretSchema = defineEntity({
  name: "SealedSecret",
  extends: Base,
  properties: {
    label: p.string(),
    secret: p.type(SealedType)
  }
})

export class SealedSecret extends SealedSecretSchema.class {}
SealedSecretSchema.setClass(SealedSecret)
