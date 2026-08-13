import {defineEntity, p} from "@mikro-orm/core"
import {expect, suite, test} from "vitest"

import {mikroOrmAdapter} from "../../src/index.js"
import * as entities from "../fixtures/entities/defaults.js"
import {BaseProperties} from "../fixtures/entities/shared/Base.js"
import {createOrm} from "../fixtures/orm.js"

const DeviceCodeSchema = defineEntity({
  name: "DeviceCode",
  properties: {
    ...BaseProperties,
    deviceCode: p.string(),
    userCode: p.string(),
    status: p.string()
  }
})

export class DeviceCode extends DeviceCodeSchema.class {}
DeviceCodeSchema.setClass(DeviceCode)

const orm = createOrm({entities: [...Object.values(entities), DeviceCode]})

// Mimics how Better Auth resolves the adapter: the factory is invoked with
// the fully-resolved auth options, including plugin schemas.
const betterAuthOptions = {
  plugins: [
    {
      id: "device-authorization",
      schema: {
        deviceCode: {
          fields: {
            deviceCode: {type: "string"},
            userCode: {type: "string"},
            status: {type: "string"}
          }
        }
      }
    }
  ]
} as never

const adapter = mikroOrmAdapter(orm, {
  debugLogs: {
    isRunningAdapterTests: true
  }
})(betterAuthOptions)

// Mirrors real-world configs that pass a partial `options` (no plugins) to
// the adapter constructor — the resolved auth options must still win inside
// transactions.
const adapterWithPartialOptions = mikroOrmAdapter(orm, {
  debugLogs: {
    isRunningAdapterTests: true
  },
  options: {advanced: {database: {generateId: false}}} as never
})(betterAuthOptions)

suite("transaction", () => {
  test("resolves plugin-defined models inside a transaction", async () => {
    const created = await adapter.create<
      {deviceCode: string; userCode: string; status: string},
      {id: string; status: string}
    >({
      model: "deviceCode",
      data: {deviceCode: "dc_123", userCode: "UC123456", status: "pending"}
    })

    // Before the fix, the transactional adapter was created with empty
    // Better Auth options, so plugin models were missing from its schema and
    // this threw `Model "deviceCode" not found in schema`.
    const updated = await adapter.transaction(async trx =>
      trx.update<{id: string; status: string}>({
        model: "deviceCode",
        where: [{field: "id", value: created.id}],
        update: {status: "approved"}
      })
    )

    expect(updated).toMatchObject({status: "approved"})
  })

  test("resolved options beat a partial constructor `options` config", async () => {
    const created = await adapterWithPartialOptions.create<
      {deviceCode: string; userCode: string; status: string},
      {id: string; status: string}
    >({
      model: "deviceCode",
      data: {deviceCode: "dc_456", userCode: "UC456789", status: "pending"}
    })

    const updated = await adapterWithPartialOptions.transaction(async trx =>
      trx.update<{id: string; status: string}>({
        model: "deviceCode",
        where: [{field: "id", value: created.id}],
        update: {status: "approved"}
      })
    )

    expect(updated).toMatchObject({status: "approved"})
  })
})
