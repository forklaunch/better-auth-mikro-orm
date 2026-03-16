import {createTestSuite, testAdapter} from "@better-auth/test-utils/adapter"
import type {BetterAuthOptions} from "better-auth"
import {toMerged} from "es-toolkit"
import {mikroOrmAdapter} from "../../src/adapter.js"
import * as entities from "../fixtures/entities/better-auth-test-suite.js"
import {createOrm} from "../fixtures/orm.js"

const orm = createOrm({
  entities: Object.values(entities),
  refreshOnEachTest: false
})

const baseOptions: BetterAuthOptions = {
  user: {
    fields: {
      email: "email_address"
    },
    additionalFields: {
      test: {
        type: "string",
        defaultValue: "test"
      }
    }
  },
  session: {
    modelName: "sessions"
  }
}

const normTestSuite = createTestSuite(
  "Normal",
  {defaultBetterAuthOptions: baseOptions},
  ({adapter, insertRandom}) => ({
    "should create a user": async () => {
      const user = await adapter.create({
        model: "user",
        data: {
          name: "Test User",
          email: `create-${Date.now()}@example.com`,
          emailVerified: false
        }
      })

      if (!user?.id) throw new Error("Expected user with id")
    },

    "should find a user by id": async () => {
      const [user] = await insertRandom("user")

      const found = await adapter.findOne<entities.User>({
        model: "user",
        where: [{field: "id", value: user.id}]
      })

      if (found?.id !== user.id) throw new Error("User not found by id")
    },

    "should find a user by email": async () => {
      const [user] = await insertRandom("user")

      const found = await adapter.findOne<entities.User>({
        model: "user",
        where: [{field: "email", value: user.email}]
      })

      if (found?.id !== user.id) throw new Error("User not found by email")
    },

    "should return null for nonexistent user": async () => {
      const found = await adapter.findOne<entities.User>({
        model: "user",
        where: [{field: "id", value: "nonexistent"}]
      })

      if (found !== null) throw new Error("Expected null")
    },

    "should update a user": async () => {
      const [user] = await insertRandom("user")

      const updated = await adapter.update<entities.User>({
        model: "user",
        where: [{field: "id", value: user.id}],
        update: {name: "Updated"}
      })

      if (updated?.name !== "Updated") throw new Error("Update failed")
    },

    "should delete a user": async () => {
      const [user] = await insertRandom("user")

      await adapter.delete({
        model: "user",
        where: [{field: "id", value: user.id}]
      })

      const found = await adapter.findOne({
        model: "user",
        where: [{field: "id", value: user.id}]
      })

      if (found !== null) throw new Error("Expected deleted")
    },

    "should find many with limit": async () => {
      await insertRandom("user", 5)

      const users = await adapter.findMany({
        model: "user",
        limit: 2
      })

      if (users.length !== 2) throw new Error(`Expected 2, got ${users.length}`)
    },

    "should count users": async () => {
      await insertRandom("user", 4)

      const count = await adapter.count({model: "user"})

      if (count < 4) throw new Error(`Expected >= 4, got ${count}`)
    },

    "should create session linked to user": async () => {
      const [user, session] = await insertRandom("session")

      if (session.userId !== user.id)
        throw new Error("Session not linked to user")
    },

    "should update many": async () => {
      const results = await insertRandom("user", 3)
      const ids = results.map(([user]: any) => user.id)

      const affected = await adapter.updateMany({
        model: "user",
        where: [{field: "id", operator: "in", value: ids}],
        update: {emailVerified: true}
      })

      if (affected !== 3)
        throw new Error(`Expected 3 affected, got ${affected}`)
    },

    "should delete many": async () => {
      const results = await insertRandom("user", 3)
      const ids = results.map(([user]: any) => user.id)

      const deleted = await adapter.deleteMany({
        model: "user",
        where: [{field: "id", operator: "in", value: ids}]
      })

      if (deleted !== 3) throw new Error(`Expected 3 deleted, got ${deleted}`)
    }
  })
)

const {execute} = await testAdapter({
  adapter: options => {
    return mikroOrmAdapter(orm, {
      debugLogs: {
        isRunningAdapterTests: true
      },
      options: toMerged(baseOptions, options)
    })
  },
  runMigrations: async () => {
    await orm.schema.refresh()
  },
  tests: [normTestSuite()],
  async onFinish() {
    await orm.close()
  }
})

execute()
