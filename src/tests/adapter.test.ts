import {rm} from "node:fs/promises"
import {join} from "node:path"

import {MikroORM} from "@mikro-orm/better-sqlite"
import type {
  Session as DatabaseSession,
  User as DatabaseUser
} from "better-auth"
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
    const user = await adapter.create<UserInput, DatabaseUser>({
      model: "user",
      data: {
        email: "john.doe@example.com",
        name: "John Doe"
      }
    })

    expect(user).toMatchObject({
      email: "john.doe@example.com",
      name: "John Doe"
    })
  })

  test("Creates a record with referenes", async () => {
    const user = orm.em.create(entities.User, {
      email: "john.doe@example.com",
      name: "John Doe"
    })

    await orm.em.persistAndFlush(user)

    const session = await adapter.create<SessionInput, DatabaseSession>({
      model: "session",
      data: {
        token: crypto.randomUUID(),
        userId: user.id,
        expiresAt: new Date()
      }
    })

    expect(session.userId).toBe(user.id)
  })
})
