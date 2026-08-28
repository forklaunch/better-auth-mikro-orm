import {defineEntity, p} from "@mikro-orm/sqlite"
import {expect, suite, test} from "vitest"

import {mikroOrmAdapter} from "../../src/adapter.ts"
import {Base} from "../fixtures/entities/shared/Base.ts"
import {createOrm} from "../fixtures/orm.ts"

/**
 * Many-to-many support is a fork-only addition. Upstream's adapter utils have
 * never carried it, so every re-take of those utils from upstream silently
 * drops it — which is exactly what happened between 0.5.6 and 0.5.8.
 *
 * Its absence is not a type error. It surfaces at runtime, on the first write
 * that touches the collection, as:
 *
 *   [Mikro ORM Adapter] Can't find property "roles" on entity "User"
 *
 * which reads like a missing field rather than a missing reference kind, and
 * took a failing end-to-end sign-up to trace back here. Hence this test: the
 * next time the utils are re-taken, this fails immediately.
 */

const RoleSchema = defineEntity({
  name: "Role",
  extends: Base,
  properties: {
    label: p.string()
  }
})

class Role extends RoleSchema.class {}
RoleSchema.setClass(Role)

const MemberSchema = defineEntity({
  name: "Member",
  extends: Base,
  properties: {
    email: p.string(),
    roles: () => p.manyToMany(Role)
  }
})

class Member extends MemberSchema.class {}
MemberSchema.setClass(Member)

const orm = createOrm({entities: [Role, Member]})

const adapter = mikroOrmAdapter(orm, {
  debugLogs: {
    isRunningAdapterTests: true
  }
})({
  plugins: [
    {
      id: "many-to-many-test",
      schema: {
        member: {
          fields: {
            email: {type: "string", required: true},
            roles: {type: "string[]", required: false}
          }
        }
      }
    }
  ]
} as never)

suite("many-to-many references", () => {
  test("an entity carrying one can be created and read back", async () => {
    const created = await adapter.create<
      {email: string},
      {id: string; email: string}
    >({
      model: "member",
      data: {email: "member@example.com"}
    })

    expect(created.id).toBeTruthy()

    const found = await adapter.findOne<{id: string; email: string}>({
      model: "member",
      where: [{field: "id", value: created.id}]
    })

    expect(found?.email).toBe("member@example.com")
  })

  test("the collection is addressable by name, not just present", async () => {
    // The regression was in property lookup, so a model merely declaring a
    // many-to-many made every write to that model throw. Reading the entity
    // back through the adapter exercises that lookup for each declared field.
    const created = await adapter.create<
      {email: string},
      {id: string; email: string}
    >({
      model: "member",
      data: {email: "second@example.com"}
    })

    const found = await adapter.findMany<{id: string}>({
      model: "member",
      where: [{field: "id", value: created.id}]
    })

    expect(found).toHaveLength(1)
  })
})
