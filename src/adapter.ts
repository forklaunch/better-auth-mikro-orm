import type {FindOptions, MikroORM} from "@mikro-orm/core"
import type {Adapter, BetterAuthOptions} from "better-auth"
import {generateId} from "better-auth"
import {dset} from "dset"

import {createAdapterUtils} from "./utils/adapterUtils.js"

/**
 * Creates Mikro ORM adapter for Better Auth.
 *
 * Current limitations:
 *   * No m:m and 1:m and embedded references support
 *   * No complex primary key support
 *
 * @param orm - Instance of Mikro ORM returned from `MikroORM.init` or `MikroORM.initSync` methods
 */
export function mikroOrmAdapter(orm: MikroORM) {
  const {
    normalizeEntityName,
    getFieldPath,
    normalizeInput,
    normalizeOutput,
    normalizeWhereClauses
  } = createAdapterUtils(orm)

  const adapter = (options: BetterAuthOptions = {}): Adapter => ({
    id: "mikro-orm",
    async create({model, data, select}) {
      const entityName = normalizeEntityName(model)
      const input = normalizeInput(entityName, data)

      if (options.advanced?.generateId !== false) {
        input.id =
          typeof options.advanced?.generateId === "function"
            ? options.advanced.generateId({model})
            : generateId()
      }

      const entity = orm.em.create(entityName, input)

      await orm.em.persistAndFlush(entity)

      return normalizeOutput(entityName, entity, select) as any
    },
    async findOne({model: entityName, where, select}) {
      entityName = normalizeEntityName(entityName)

      const entity = await orm.em.findOne(
        entityName,
        normalizeWhereClauses(entityName, where)
      )

      if (!entity) {
        return null
      }

      return normalizeOutput(entityName, entity, select) as any
    },
    async findMany({model: entityName, where, limit, offset, sortBy}) {
      entityName = normalizeEntityName(entityName)

      const options: FindOptions<any> = {
        limit,
        offset
      }

      if (sortBy) {
        const path = getFieldPath(entityName, sortBy.field)
        dset(options, ["orderBy", ...path], sortBy.direction)
      }

      const rows = await orm.em.find(
        entityName,
        normalizeWhereClauses(entityName, where),
        options
      )

      return rows.map(row => normalizeOutput(entityName, row)) as any
    },
    async update({model: entityName, where, update}) {
      entityName = normalizeEntityName(entityName)

      const entity = await orm.em.findOne(
        entityName,
        normalizeWhereClauses(entityName, where)
      )

      if (!entity) {
        return null
      }

      orm.em.assign(entity, normalizeInput(entityName, update))
      await orm.em.flush()

      return normalizeOutput(entityName, entity) as any
    },
    async updateMany({model: entityName, where, update}) {
      entityName = normalizeEntityName(entityName)

      const affected = await orm.em.nativeUpdate(
        entityName,
        normalizeWhereClauses(entityName, where),
        normalizeInput(entityName, update)
      )

      orm.em.clear()

      return affected
    },
    async delete({model: entityName, where}) {
      entityName = normalizeEntityName(entityName)

      const entity = await orm.em.findOne(
        entityName,
        normalizeWhereClauses(entityName, where)
      )

      if (entity) {
        await orm.em.removeAndFlush(entity)
      }
    },
    async deleteMany({model: entityName, where}) {
      entityName = normalizeEntityName(entityName)

      const affected = await orm.em.nativeDelete(
        entityName,
        normalizeWhereClauses(entityName, where)
      )

      orm.em.clear() // This clears the IdentityMap

      return affected
    }
  })

  return adapter
}
