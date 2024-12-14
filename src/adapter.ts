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
    getEntityMetadata,
    getFieldPath,
    normalizeInput,
    normalizeOutput,
    normalizeWhereClauses
  } = createAdapterUtils(orm)

  const adapter = (options: BetterAuthOptions = {}): Adapter => ({
    id: "mikro-orm",
    async create({model, data, select}) {
      const metadata = getEntityMetadata(model)
      const input = normalizeInput(metadata, data)

      if (options.advanced?.generateId !== false) {
        input.id =
          typeof options.advanced?.generateId === "function"
            ? options.advanced.generateId({model})
            : generateId()
      }

      const entity = orm.em.create(metadata.class, input)

      await orm.em.persistAndFlush(entity)

      return normalizeOutput(metadata, entity, select) as any
    },
    async findOne({model, where, select}) {
      const metadata = getEntityMetadata(model)

      const entity = await orm.em.findOne(
        metadata.class,
        normalizeWhereClauses(metadata, where)
      )

      if (!entity) {
        return null
      }

      return normalizeOutput(metadata, entity, select) as any
    },
    async findMany({model, where, limit, offset, sortBy}) {
      const metadata = getEntityMetadata(model)

      const options: FindOptions<any> = {
        limit,
        offset
      }

      if (sortBy) {
        const path = getFieldPath(metadata, sortBy.field)
        dset(options, ["orderBy", ...path], sortBy.direction)
      }

      const rows = await orm.em.find(
        metadata.class,
        normalizeWhereClauses(metadata, where),
        options
      )

      return rows.map(row => normalizeOutput(metadata, row)) as any
    },
    async update({model, where, update}) {
      const metadata = getEntityMetadata(model)

      const entity = await orm.em.findOne(
        metadata.class,
        normalizeWhereClauses(metadata, where)
      )

      if (!entity) {
        return null
      }

      orm.em.assign(entity, normalizeInput(metadata, update))
      await orm.em.flush()

      return normalizeOutput(metadata, entity) as any
    },
    async updateMany({model, where, update}) {
      const metadata = getEntityMetadata(model)

      const affected = await orm.em.nativeUpdate(
        metadata.class,
        normalizeWhereClauses(metadata, where),
        normalizeInput(metadata, update)
      )

      orm.em.clear()

      return affected
    },
    async delete({model, where}) {
      const metadata = getEntityMetadata(model)

      const entity = await orm.em.findOne(
        metadata.class,
        normalizeWhereClauses(metadata, where)
      )

      if (entity) {
        await orm.em.removeAndFlush(entity)
      }
    },
    async deleteMany({model, where}) {
      const metadata = getEntityMetadata(model)

      const affected = await orm.em.nativeDelete(
        metadata.class,
        normalizeWhereClauses(metadata, where)
      )

      orm.em.clear() // This clears the IdentityMap

      return affected
    }
  })

  return adapter
}
