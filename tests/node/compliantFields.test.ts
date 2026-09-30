import {expect, suite, test} from "vitest"

import {mikroOrmAdapter} from "../../src/adapter.ts"
import {SealedSecret} from "../fixtures/entities/sealed-secret/SealedSecret.ts"
import {createOrm} from "../fixtures/orm.ts"

const orm = createOrm({entities: [SealedSecret]})

const adapter = mikroOrmAdapter(orm, {
  debugLogs: {isRunningAdapterTests: true}
})({
  plugins: [
    {
      id: "sealed-secret-test",
      schema: {
        sealedSecret: {
          fields: {
            label: {type: "string", required: true},
            secret: {type: "string", required: true}
          }
        }
      }
    }
  ]
} as never)

suite("compliant fields", () => {
  test("are returned to Better Auth as their values, not `{}`", async () => {
    const created = await adapter.create({
      model: "sealedSecret",
      data: {label: "jwks", secret: "private-key-material"}
    })
    expect(created).toMatchObject({secret: "private-key-material"})

    orm.em.clear()
    const found = await adapter.findOne<{secret: unknown}>({
      model: "sealedSecret",
      where: [{field: "label", value: "jwks"}]
    })
    expect(found?.secret).toBe("private-key-material")

    const [row] = await orm.em
      .getConnection()
      .execute("select secret from sealed_secret")
    expect(row.secret).toBe("sealed:private-key-material")
  })
})
