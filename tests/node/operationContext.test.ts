import {AsyncLocalStorage} from "node:async_hooks"
import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto"
import {defineEntity, p, Type} from "@mikro-orm/sqlite"
import {betterAuth} from "better-auth"
import {expect, test} from "vitest"
import {mikroOrmAdapter} from "../../src/adapter.ts"
import {Base} from "../fixtures/entities/shared/Base.ts"
import {createOrm} from "../fixtures/orm.ts"

const scope = new AsyncLocalStorage<Buffer>()
const key = randomBytes(32)
class ScopedCipher extends Type<string, string> {
  override convertToDatabaseValue(value: string): string {
    const secret = scope.getStore()
    if (!secret) throw new Error("Encryption context missing")
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", secret, iv)
    return Buffer.concat([
      iv,
      cipher.update(value),
      cipher.final(),
      cipher.getAuthTag()
    ]).toString("base64")
  }
  override convertToJSValue(value: string): string {
    const secret = scope.getStore()
    if (!secret) throw new Error("Encryption context missing")
    const bytes = Buffer.from(value, "base64")
    const decipher = createDecipheriv(
      "aes-256-gcm",
      secret,
      bytes.subarray(0, 12)
    )
    decipher.setAuthTag(bytes.subarray(-16))
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final()
    ]).toString()
  }
  override getColumnType() {
    return "text"
  }
}
const user = defineEntity({
  name: "User",
  extends: Base,
  properties: {
    name: p.string(),
    email: p.string().unique(),
    emailVerified: p.boolean().default(false),
    image: p.string().nullable()
  }
})
const account = defineEntity({
  name: "Account",
  extends: Base,
  properties: {
    userId: p.string(),
    accountId: p.string(),
    providerId: p.string(),
    issuer: p.string().default("fixture"),
    accessToken: p.string().nullable(),
    refreshToken: p.string().nullable(),
    accessTokenExpiresAt: p.datetime().nullable(),
    refreshTokenExpiresAt: p.datetime().nullable(),
    scope: p.string().nullable(),
    idToken: p.string().nullable(),
    password: p.type(ScopedCipher).nullable()
  }
})
const session = defineEntity({
  name: "Session",
  extends: Base,
  properties: {
    userId: p.string(),
    token: p.string().unique(),
    expiresAt: p.datetime(),
    ipAddress: p.string().nullable(),
    userAgent: p.string().nullable()
  }
})
const verification = defineEntity({
  name: "Verification",
  extends: Base,
  properties: {
    identifier: p.string(),
    value: p.string(),
    expiresAt: p.datetime()
  }
})
class User extends user.class {}
user.setClass(User)
class Account extends account.class {}
account.setClass(Account)
class Session extends session.class {}
session.setClass(Session)
class Verification extends verification.class {}
verification.setClass(Verification)
const orm = createOrm({entities: [User, Account, Session, Verification]})
const context = <T>(run: () => Promise<T>) => scope.run(key, run)
const database = mikroOrmAdapter(orm, {operationContext: context})
const auth = betterAuth({
  baseURL: "http://localhost:3999",
  secret: "synthetic-operation-context-test-secret-only",
  database,
  emailAndPassword: {enabled: true},
  advanced: {database: {generateId: () => crypto.randomUUID()}}
})

test("direct BetterAuth signup, signin and session work without an HTTP context wrapper", async () => {
  await auth.api.signUpEmail({
    body: {
      name: "Fixture",
      email: "fixture@example.test",
      password: "Synthetic-password-42!"
    }
  })
  orm.em.clear()
  const response = await auth.api.signInEmail({
    body: {email: "fixture@example.test", password: "Synthetic-password-42!"},
    asResponse: true
  })
  expect(response.status).toBe(200)
  const cookie = response.headers
    .getSetCookie()
    .map(value => value.split(";")[0])
    .join("; ")
  const current = await auth.api.getSession({headers: new Headers({cookie})})
  expect(current?.user.email).toBe("fixture@example.test")
  expect(scope.getStore()).toBeUndefined()
  const rows = await orm.em
    .getConnection()
    .execute("select password from account")
  expect(rows[0].password).not.toContain("Synthetic-password")
  await expect(
    auth.api.signInEmail({
      body: {email: "fixture@example.test", password: "wrong-password"}
    })
  ).rejects.toThrow()
})

test("existing ciphertext remains unchanged, wrong key is refused, and transaction scope survives flush", async () => {
  const adapter = database({})
  const created = await adapter.create({
    model: "account",
    data: {
      userId: crypto.randomUUID(),
      accountId: "legacy",
      providerId: "credential",
      password: "existing-secret"
    }
  })
  const before = await orm.em
    .getConnection()
    .execute("select password from account")
  orm.em.clear()
  expect(
    await adapter.findOne({
      model: "account",
      where: [{field: "id", value: created.id}]
    })
  ).toMatchObject({password: "existing-secret"})
  expect(
    await orm.em.getConnection().execute("select password from account")
  ).toEqual(before)
  orm.em.clear()
  const other = mikroOrmAdapter(orm, {
    operationContext: run => scope.run(randomBytes(32), run)
  })({})
  await expect(
    other.findOne({model: "account", where: [{field: "id", value: created.id}]})
  ).rejects.toThrow()
  orm.em.clear()
  await adapter.transaction(async tx => {
    expect(scope.getStore()).toBe(key)
    await tx.update({
      model: "account",
      where: [{field: "id", value: created.id}],
      update: {password: "changed"}
    })
    await Promise.resolve()
    expect(scope.getStore()).toBe(key)
  })
  expect(scope.getStore()).toBeUndefined()
  orm.em.clear()
  expect(
    await adapter.findOne({
      model: "account",
      where: [{field: "id", value: created.id}]
    })
  ).toMatchObject({password: "changed"})
})

test("omitting context does not invent a key and failed transactions restore scope", async () => {
  const adapter = database({})
  const created = await adapter.create({
    model: "account",
    data: {
      userId: crypto.randomUUID(),
      accountId: "kept",
      providerId: "credential",
      password: "retained"
    }
  })
  orm.em.clear()
  await expect(
    mikroOrmAdapter(orm)({}).findOne({
      model: "account",
      where: [{field: "id", value: created.id}]
    })
  ).rejects.toThrow("Encryption context missing")
  orm.em.clear()
  await expect(
    adapter.transaction(async tx => {
      await tx.update({
        model: "account",
        where: [{field: "id", value: created.id}],
        update: {password: "rollback"}
      })
      throw new Error("stop transaction")
    })
  ).rejects.toThrow("stop transaction")
  expect(scope.getStore()).toBeUndefined()
  orm.em.clear()
  expect(
    await adapter.findOne({
      model: "account",
      where: [{field: "id", value: created.id}]
    })
  ).toMatchObject({password: "retained"})
})
