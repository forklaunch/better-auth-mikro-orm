import {rm} from "node:fs/promises"
import {join} from "node:path"

import {MikroORM} from "@mikro-orm/better-sqlite"
import {afterAll, beforeAll, beforeEach} from "vitest"

import * as entities from "./entities.js"

export function createOrm(): MikroORM {
  const dbName = join(import.meta.dirname, `${crypto.randomUUID()}.sqlite`)

  const orm = MikroORM.initSync({
    dbName,
    entities: Object.values(entities),
    ensureDatabase: true,
    allowGlobalContext: true
  })

  beforeAll(async () => await orm.connect())

  beforeEach(async () => await orm.getSchemaGenerator().refreshDatabase())

  afterAll(async () => {
    await orm.close()
    await rm(dbName)
  })

  return orm
}
