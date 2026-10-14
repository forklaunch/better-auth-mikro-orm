import {randomUUID} from "node:crypto"
import {RequestContext} from "@mikro-orm/core"
import {defineEntity, MikroORM, p} from "@mikro-orm/postgresql"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from "vitest"

import {mikroOrmAdapter} from "../../src/adapter.ts"

const Verification = defineEntity({
  name: "Verification",
  properties: {
    id: p.string().primary(),
    identifier: p.string(),
    value: p.string(),
    expiresAt: p.datetime(),
    createdAt: p.datetime(),
    updatedAt: p.datetime()
  }
})

// Use a dedicated database: this suite replaces its verification table.
const clientUrl = process.env.ADAPTER_TEST_POSTGRES_URL

describe.skipIf(!clientUrl)("consumeOne with PostgreSQL", () => {
  let orm: Awaited<ReturnType<typeof MikroORM.init>>
  let adapter: ReturnType<ReturnType<typeof mikroOrmAdapter>>

  beforeAll(async () => {
    orm = await MikroORM.init({clientUrl, entities: [Verification]})
    await orm.schema.refresh()
    adapter = mikroOrmAdapter(orm)({})
  })

  beforeEach(async () => {
    await orm.em.fork().nativeDelete(Verification, {})
  })

  afterAll(async () => {
    await orm?.close()
  })

  const input = (identifier: string) => ({
    id: randomUUID(),
    identifier,
    value: "single-use-test-value",
    expiresAt: new Date(Date.now() + 600_000),
    createdAt: new Date(),
    updatedAt: new Date()
  })
  const consume = (identifier: string) =>
    adapter.consumeOne({
      model: "verification",
      where: [{field: "identifier", value: identifier}]
    })

  test("a later adapter write cannot resurrect a consumed credential", async () => {
    await RequestContext.create(orm.em, async () => {
      await adapter.create({model: "verification", data: input("original")})
      expect(await consume("original")).toMatchObject({identifier: "original"})
      expect(
        await orm.em.fork().count(Verification, {identifier: "original"})
      ).toBe(0)

      // Same request/EntityManager: create flushes after nativeDelete.
      await adapter.create({model: "verification", data: input("later-write")})
      expect(
        await orm.em.fork().count(Verification, {identifier: "original"})
      ).toBe(0)
      expect(await consume("original")).toBeNull()
    })
  })

  test("consumption inside a transaction survives a later parent-context flush", async () => {
    const seed = orm.em.fork()
    seed.create(Verification, input("transactional"))
    await seed.flush()
    await RequestContext.create(orm.em, async () => {
      await adapter.findOne({
        model: "verification",
        where: [{field: "identifier", value: "transactional"}]
      })
      const consumed = await adapter.transaction(async tx => {
        const result = await tx.consumeOne({
          model: "verification",
          where: [{field: "identifier", value: "transactional"}]
        })
        await tx.create({
          model: "verification",
          data: input("inside-transaction")
        })
        return result
      })
      expect(consumed).toBeTruthy()
      await adapter.create({
        model: "verification",
        data: input("after-transaction")
      })
      expect(
        await orm.em.fork().count(Verification, {identifier: "transactional"})
      ).toBe(0)
      expect(await consume("transactional")).toBeNull()
    })
  })

  test("two consumers that both read the row still have exactly one winner", async () => {
    const seed = orm.em.fork()
    seed.create(Verification, input("racing"))
    await seed.flush()
    let readers = 0
    let release!: () => void
    const bothRead = new Promise<void>(resolve => {
      release = resolve
    })

    const run = (index: number) =>
      RequestContext.create(orm.em, async () => {
        const em = orm.em.getContext()
        const findOne = em.findOne.bind(em)
        const spy = vi
          .spyOn(em, "findOne")
          .mockImplementation(async (...args) => {
            const row = await findOne(...args)
            if (++readers === 2) release()
            await bothRead
            return row
          })
        try {
          const result = await consume("racing")
          await adapter.create({
            model: "verification",
            data: input(`later-${index}`)
          })
          return result
        } finally {
          spy.mockRestore()
        }
      })

    const results = await Promise.all([run(1), run(2)])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(results.filter(value => value === null)).toHaveLength(1)
    expect(
      await orm.em.fork().count(Verification, {identifier: "racing"})
    ).toBe(0)
    await RequestContext.create(orm.em, async () => {
      expect(await consume("racing")).toBeNull()
    })
  })
})
