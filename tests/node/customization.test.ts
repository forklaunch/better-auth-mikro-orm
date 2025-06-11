import {expect, suite, test} from "vitest"

import type {User as DatabaseUser} from "better-auth"

import {mikroOrmAdapter} from "../../src/adapter.js"
import {createOrm} from "../fixtures/orm.js"
import {createRandomUsersUtils} from "../fixtures/randomUsers.js"
import type {UserInput} from "../utils/types.js"

suite("custom entity (model) names", async () => {
  const entities = await import("../fixtures/entities/custom-entity-name.js")
  const orm = createOrm({
    entities: Object.values(entities)
  })

  const randomUsers = createRandomUsersUtils(orm)
  const adapter = mikroOrmAdapter(orm)({
    user: {
      modelName: "custom_user"
    }
  })

  test("creates a record", async () => {
    const expected = randomUsers.createOne()

    const actual = await adapter.create<UserInput, DatabaseUser>({
      model: "user",
      data: expected
    })

    expect(actual).toMatchObject(expected)
  })
})

suite("custom field names", async () => {
  const entities = await import("../fixtures/entities/custom-field-name.js")
  const orm = createOrm({
    entities: Object.values(entities)
  })

  const randomUsers = createRandomUsersUtils(orm)
  const adapter = mikroOrmAdapter(orm)({
    user: {
      fields: {
        email: "emailAddress" // TODO: Test snake_case
      }
    }
  })

  test("creates a record", async () => {
    const expected = randomUsers.createOne()

    const actual = await adapter.create<UserInput, DatabaseUser>({
      model: "user",
      data: expected
    })

    expect(actual).toMatchObject(expected)
  })
})
