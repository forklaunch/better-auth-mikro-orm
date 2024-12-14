import {rm} from "node:fs/promises"
import {join} from "node:path"

import {faker} from "@faker-js/faker"
import {MikroORM} from "@mikro-orm/better-sqlite"
import type {
  Session as DatabaseSession,
  User as DatabaseUser
} from "better-auth"
import {BetterAuthError, generateId} from "better-auth"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from "vitest"
import {NIL} from "uuid"

import {mikroOrmAdapter} from "../index.js"

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

type GetRandomUsers = (amount?: number) => UserInput[]

type GetRandomUser = () => UserInput

type SeedRandomUsers = (amount?: number) => Promise<entities.User[]>

type SeedRandomUser = () => Promise<entities.User>

interface AdapterTestUsersContext {
  getMany: GetRandomUsers
  getSingle: GetRandomUser
  seedSingle: SeedRandomUser
  seedMany: SeedRandomUsers
}

interface AdapterTest {
  randomUsers: AdapterTestUsersContext
}

const createRandomUser: GetRandomUser = () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const name = [firstName, lastName].join(" ")
  const email = faker.internet.email({firstName, lastName})

  return {email, name}
}

const getRandomUsers: GetRandomUsers = (amount = 1) =>
  Array.from({length: amount}, () => createRandomUser())

const seedRandomUser: SeedRandomUser = async () => {
  const user = orm.em.create(entities.User, createRandomUser(), {
    persist: true
  })

  await orm.em.flush()

  return user
}

const seedRandomUsers: SeedRandomUsers = async amount => {
  const users = getRandomUsers(amount).map(user =>
    orm.em.create(entities.User, user, {
      persist: true
    })
  )

  await orm.em.flush()

  return users
}

const adapterTest = test.extend<AdapterTest>({
  async randomUsers({task: _}, use) {
    await use({
      getMany: getRandomUsers,
      getSingle: createRandomUser,
      seedSingle: seedRandomUser,
      seedMany: seedRandomUsers
    })
  }
})

beforeAll(async () => await orm.connect())

beforeEach(async () => await orm.getSchemaGenerator().refreshDatabase())

afterAll(async () => {
  await orm.close()
  await rm(dbName)
})

describe("create", () => {
  adapterTest("a new record", async ({randomUsers}) => {
    const expected = randomUsers.getSingle()
    const actual = await adapter.create<UserInput, DatabaseUser>({
      model: "user",
      data: expected
    })

    expect(actual).toMatchObject(expected)
  })

  adapterTest("with a reference", async ({randomUsers}) => {
    const user = orm.em.create(entities.User, randomUsers.getSingle())

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

  adapterTest(
    "custom generateId function",

    async ({randomUsers}) => {
      const expected = "451"
      const adapter = mikroOrmAdapter(orm)({
        advanced: {
          generateId: () => expected
        }
      })

      const actual = await adapter.create<UserInput, DatabaseUser>({
        model: "user",
        data: randomUsers.getSingle()
      })

      expect(actual.id).toBe(expected)
    }
  )

  adapterTest(
    "generateId disabled and handled by ORM",

    async ({randomUsers, onTestFinished}) => {
      const fn = vi.spyOn(crypto, "randomUUID").mockReturnValue(NIL)

      onTestFinished(() => {
        fn.mockRestore()
      })

      const adapter = mikroOrmAdapter(orm)({
        advanced: {
          generateId: false
        }
      })

      await adapter.create<UserInput, DatabaseUser>({
        model: "user",
        data: randomUsers.getSingle()
      })

      expect(fn).toHaveBeenCalledOnce()
      expect(fn).toHaveReturnedWith(NIL)
    }
  )
})

describe("findOne", () => {
  adapterTest("by id", async ({randomUsers}) => {
    const expected = orm.em.create(entities.User, randomUsers.getSingle())

    await orm.em.persistAndFlush(expected)

    const actual = await adapter.findOne<DatabaseUser>({
      model: "user",
      where: [
        {
          field: "id",
          value: expected.id
        }
      ]
    })

    expect(actual?.id).toBe(expected.id)
  })

  adapterTest("by arbitary field", async ({randomUsers}) => {
    const expected = orm.em.create(entities.User, randomUsers.getSingle())

    await orm.em.persistAndFlush(expected)

    const actual = await adapter.findOne<DatabaseUser>({
      model: "user",
      where: [
        {
          field: "email",
          value: expected.email
        }
      ]
    })

    expect(actual?.id).toBe(expected.id)
  })

  adapterTest("returns only selected fields", async ({randomUsers}) => {
    const user = orm.em.create(entities.User, randomUsers.getSingle())

    await orm.em.persistAndFlush(user)

    const actual = await adapter.findOne({
      model: "user",
      where: [
        {
          field: "id",
          value: user.id
        }
      ],
      select: ["email"]
    })

    expect(actual).toEqual({email: user.email})
  })

  adapterTest("returns null for nonexistent record", async () => {
    const actual = adapter.findOne<DatabaseUser>({
      model: "user",
      where: [
        {
          field: "id",
          value: "test"
        }
      ]
    })

    await expect(actual).resolves.toBeNull()
  })
})

describe("findMany", () => {
  adapterTest("returns all records", async ({randomUsers}) => {
    const users = await randomUsers.seedMany(10)
    const actual = await adapter.findMany<DatabaseUser>({
      model: "user"
    })

    expect(actual.map(({id}) => id)).toEqual(users.map(({id}) => id))
  })

  adapterTest("limit", async ({randomUsers}) => {
    const limit = 6
    const users = await randomUsers.seedMany(10)

    const expected = users.slice(0, limit).map(({id}) => id)
    const actual = await adapter.findMany<DatabaseUser>({
      model: "user",
      limit
    })

    expect(actual.map(({id}) => id)).toEqual(expected)
  })

  adapterTest("offset", async ({randomUsers}) => {
    const offset = 3
    const users = await randomUsers.seedMany(4)

    const expected = users.slice(offset).map(({id}) => id)
    const actual = await adapter.findMany<DatabaseUser>({
      model: "user",
      offset
    })

    expect(actual.map(({id}) => id)).toEqual(expected)
  })

  adapterTest("sortBy", async ({randomUsers}) => {
    const users = randomUsers.getMany(3).map((user, index) =>
      orm.em.create(entities.User, {
        ...user,

        email: `user-${index + 1}@example.com`
      })
    )

    await orm.em.persistAndFlush(users)

    const [user1, user2, user3] = users

    const actual = await adapter.findMany<DatabaseUser>({
      model: "user",
      sortBy: {
        field: "email",
        direction: "desc"
      }
    })

    expect(actual.map(({id}) => id)).toEqual([user3.id, user2.id, user1.id])
  })
})

describe("errors", () => {
  adapterTest("entity not found", async () => {
    try {
      await adapter.create({
        model: "unknown",
        data: {}
      })
    } catch (error) {
      expect(error).toBeInstanceOf(BetterAuthError)
      expect((error as BetterAuthError).message).toBe(
        '[Mikro ORM Adapter] Cannot find metadata for "Unknown" entity. Make sure it defined and listed in your Mikro ORM config.'
      )
    }
  })
})
