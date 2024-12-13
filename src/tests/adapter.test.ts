import {rm} from "node:fs/promises"
import {join} from "node:path"

import {MikroORM} from "@mikro-orm/better-sqlite"
import {faker} from "@faker-js/faker"
import type {
  Session as DatabaseSession,
  User as DatabaseUser
} from "better-auth"
import {generateId} from "better-auth"
import {afterAll, beforeAll, beforeEach, describe, expect, test} from "vitest"

import {mikroOrmAdapter} from "../adapter.js"

import * as entities from "./entities.js"

interface UserInput {
  email: string
  name: string
}

interface SessionInput {
  token: string
  userId: string
  expiresAt: Date
}

function createRandomUser(): UserInput {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const name = [firstName, lastName].join(" ")
  const email = faker.internet.email({firstName, lastName})

  return {email, name}
}

const dbName = join(import.meta.dirname, "test.sqlite")

const orm = MikroORM.initSync({
  dbName,
  ensureDatabase: true,
  allowGlobalContext: true,
  entities: Object.values(entities)
})

const adapter = mikroOrmAdapter(orm)()

beforeAll(async () => await orm.connect())

beforeEach(async () => await orm.getSchemaGenerator().refreshDatabase())

afterAll(async () => {
  await orm.close()
  await rm(dbName)
})

describe("create", () => {
  test("Creates a record", async () => {
    const expected = createRandomUser()
    const actual = await adapter.create<UserInput, DatabaseUser>({
      model: "user",
      data: expected
    })

    expect(actual).toMatchObject(expected)
  })

  test("Creates a record with referenes", async () => {
    const user = orm.em.create(entities.User, createRandomUser())

    await orm.em.persistAndFlush(user)

    const actual = await adapter.create<SessionInput, DatabaseSession>({
      model: "session",
      data: {
        token: generateId(),
        userId: user.id,
        expiresAt: new Date()
      }
    })

    expect(actual.userId).toBe(user.id)
  })
})
