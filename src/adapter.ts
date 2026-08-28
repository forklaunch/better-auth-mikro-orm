import type {FindOptions} from "@mikro-orm/core"
import {
  type AdapterFactoryCustomizeAdapterCreator,
  createAdapterFactory,
  type DBAdapterDebugLogOption
} from "better-auth/adapters"
import type {BetterAuthOptions, Where} from "better-auth/types"
import {dset} from "dset"

import {createAdapterUtils} from "./utils/adapterUtils.ts"
import type {AnyMikroOrm} from "./utils/anyMikroOrm.ts"

export type {AnyMikroOrm} from "./utils/anyMikroOrm.ts"

export interface MikroOrmAdapterConfig {
  /**
   * Enable debug logs.
   *
   * @default false
   */
  debugLogs?: DBAdapterDebugLogOption

  /**
   * Indicates whether or not JSON is supported by target database.
   *
   * This option is enabled by default, because Mikro ORM supports JSON serialization/deserialization via [JsonType](https://mikro-orm.io/docs/custom-types#jsontype).
   * See documentation for more info: https://mikro-orm.io/docs/json-properties
   *
   * If disabled, Better Auth will handle these transformations for you.
   *
   * @default true
   */
  supportsJSON?: boolean

  /**
   * Options for the Better Auth adapter.
   */
  options?: BetterAuthOptions
}

const adapter: (orm: AnyMikroOrm) => AdapterFactoryCustomizeAdapterCreator =
  orm => config => {
    const {
      getEntityMetadata,
      getFieldPath,
      normalizeInput,
      normalizeOutput,
      normalizeWhereClauses,
      normalizeSelect
    } = createAdapterUtils(orm, config)

    return {
      async create({model, data, select}) {
        const metadata = getEntityMetadata(model)
        const input = normalizeInput(metadata, data)
        const entity = orm.em.create(metadata.class, input)

        // A failed flush leaves the entity in the identity map, where it
        // poisons every later flush on the same EntityManager with the same
        // error. Evicting it keeps the failure local to this call.
        try {
          await orm.em.flush()
        } catch (error) {
          await orm.em.remove(entity).flush()

          throw error
        }

        return normalizeOutput(
          metadata,
          entity,
          normalizeSelect(model, select)
        ) as any
      },

      async count({model, where}): Promise<number> {
        const metadata = getEntityMetadata(model)

        return orm.em.count(
          metadata.class,
          normalizeWhereClauses(metadata, where)
        )
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

        const result = normalizeOutput(
          metadata,
          entity,
          normalizeSelect(model, select)
        ) as any

        return result
      },

      async findMany({model, where, limit, offset, sortBy, select}) {
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

        const normalizedSelect = normalizeSelect(model, select)
        const result = rows.map(row =>
          normalizeOutput(metadata, row, normalizedSelect)
        ) as any

        return result
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

        orm.em.assign(entity, normalizeInput(metadata, update as any))

        // A failed flush leaves the entity in the identity map, where it
        // poisons every later flush on the same EntityManager with the same
        // error. Evicting it keeps the failure local to this call.
        try {
          await orm.em.flush()
        } catch (error) {
          await orm.em.remove(entity).flush()

          throw error
        }

        return normalizeOutput(metadata, entity) as any
      },

      async updateMany({model, where, update}) {
        const metadata = getEntityMetadata(model)

        return orm.em.nativeUpdate(
          metadata.class,
          normalizeWhereClauses(metadata, where),
          normalizeInput(metadata, update as any)
        )
      },

      async delete({model, where}) {
        const metadata = getEntityMetadata(model)

        const entity = await orm.em.findOne(
          metadata.class,

          normalizeWhereClauses(metadata, where),

          {
            fields: ["id"]
          }
        )

        if (entity) {
          await orm.em.remove(entity).flush()
        }
      },

      async deleteMany({model, where}) {
        const metadata = getEntityMetadata(model)

        return orm.em.nativeDelete(
          metadata.class,
          normalizeWhereClauses(metadata, where)
        )
      },

      // Atomic single-use consumption, required by Better Auth >= 1.7 —
      // there is no fallback for it, and the factory throws outright when an
      // adapter does not implement it.
      //
      // It backs one-shot credentials: a verification token, a one-time code.
      // The contract is that exactly one caller may ever receive a given row,
      // so a plain findOne-then-delete is wrong. Two concurrent callers would
      // both find the row and both return it, and the credential would be
      // accepted twice.
      //
      // The delete is therefore the arbiter rather than the read. It carries
      // the original guard AND the primary key of the row just read, so the
      // database decides the winner: whoever's DELETE reports a row wins and
      // returns the snapshot, and the loser sees zero rows affected and gets
      // null. The row is read before deletion because the caller needs its
      // contents, and afterwards it no longer exists to be read.
      async consumeOne({model, where}: {model: string; where: Where[]}) {
        const metadata = getEntityMetadata(model)
        const filter = normalizeWhereClauses(metadata, where)

        const entity = await orm.em.findOne(metadata.class, filter)

        if (!entity) {
          return null
        }

        // Captured before the delete: afterwards there is nothing to read.
        const snapshot = normalizeOutput(metadata, entity) as any

        const primaryKey = metadata.primaryKeys[0] ?? "id"
        const affected = await orm.em.nativeDelete(metadata.class, {
          ...filter,
          [primaryKey]: (entity as Record<string, unknown>)[primaryKey]
        } as any)

        if (affected < 1) {
          // Another caller consumed it between the read and the delete.
          return null
        }

        // nativeDelete bypasses the identity map, so the deleted row would
        // otherwise linger there and be handed back by a later findOne on the
        // same EntityManager.
        orm.em.getUnitOfWork().unsetIdentity(entity)

        return snapshot
      },

      // Guarded conditional update. The `where` is both selector and guard:
      // if no row matches it, nothing is written and null is returned, which
      // is what lets callers use this as a compare-and-set.
      //
      // Two independent payloads arrive, and BOTH are required:
      //
      //   increment - fields to add to, read-modify-write against the row
      //   set       - fields to assign outright, whatever their old value
      //
      // Handling only `increment` looks sufficient because the method is
      // named for it, but Better Auth calls this with an EMPTY `increment`
      // and a populated `set` whenever it wants a guarded assignment. The
      // device authorization flow is the case that matters most:
      //
      //   incrementOne({
      //     model: "deviceCode",
      //     where: [{id}, {status: "pending"}, {userId: null}],
      //     increment: {},
      //     set: {userId: session.user.id}
      //   })
      //
      // That is how a browser claims a pending CLI login code. Dropping
      // `set` made it a silent no-op: the loop over an empty `increment`
      // produced an empty patch, flush wrote nothing, and the row kept
      // `userId = null` — so the later approve step correctly refused to
      // approve an unclaimed code and CLI login could never complete.
      //
      // Silent is the operative word. The truthy entity returned below tells
      // Better Auth the claim succeeded, so it updates its in-memory copy
      // and reports success while the database row is unchanged. Nothing
      // errors and nothing logs; the failure surfaces one request later.
      //
      // Note that Better Auth's own factory carries a correct findMany +
      // updateMany implementation and uses it only when the adapter defines
      // no `incrementOne`. Defining a broken one is therefore strictly worse
      // than defining none at all.
      //
      // The same shape is used by the rate limiter, two-factor verification
      // and backup-code redemption.
      async incrementOne({
        model,
        where,
        increment,
        set
      }: {
        model: string
        where: Where[]
        increment?: Record<string, number>
        set?: Record<string, unknown>
      }) {
        const metadata = getEntityMetadata(model)

        const entity = await orm.em.findOne(
          metadata.class,
          normalizeWhereClauses(metadata, where)
        )

        if (!entity) {
          return null
        }

        const current = normalizeOutput(metadata, entity) as Record<
          string,
          unknown
        >

        // `set` is applied first so an explicit assignment cannot silently
        // overwrite a computed counter when a caller names the same field in
        // both payloads; the increment is the more specific intent.
        const patch: Record<string, unknown> = {...set}
        for (const [field, by] of Object.entries(increment ?? {})) {
          patch[field] = (Number(current[field]) || 0) + (by as number)
        }

        orm.em.assign(entity, normalizeInput(metadata, patch as any))
        await orm.em.flush()

        return normalizeOutput(metadata, entity) as any
      }
    }
  }

/**
 * Creates Mikro ORM adapter for Better Auth.
 *
 * Current limitations:
 *   * No m:m and 1:m and embedded references support
 *   * No complex primary key support
 *   * No schema generation
 *
 * @param orm - Instance of Mikro ORM returned from `MikroORM.init` or `MikroORM.initSync` methods
 * @param config - Additional configuration for Mikro ORM adapter
 */
export const mikroOrmAdapter = (
  orm: AnyMikroOrm,
  {debugLogs, supportsJSON = true, options}: MikroOrmAdapterConfig = {}
) => {
  // Better Auth invokes the returned factory with the fully-resolved auth
  // options (including plugin schemas). The transactional adapter must be
  // built with those same options — building it with `{}` drops every plugin
  // table from the schema, so any transactional write to a plugin model (the
  // device-authorization claim, for one) throws
  // `Model "<name>" not found in schema`.
  let resolvedOptions: BetterAuthOptions | undefined

  const factory = createAdapterFactory({
    adapter: adapter(orm),
    config: {
      adapterId: "mikro-orm-adapter",
      adapterName: "Mikro ORM Adapter",
      debugLogs,
      supportsJSON,
      transaction: async cb => {
        return orm.em.transactional(async () => {
          return cb(
            createAdapterFactory({
              adapter: adapter(orm),
              config: {
                debugLogs,
                supportsJSON,
                adapterId: "mikro-orm-adapter-transaction",
                adapterName: "Mikro ORM Adapter Transaction"
              }
            })(
              // Prefer the options Better Auth resolved the outer factory
              // with — an explicit `options` config is typically partial (no
              // plugin schemas) and must not shadow them.
              resolvedOptions ?? options ?? {}
            )
          )
        })
      }
    }
  })

  return (betterAuthOptions: BetterAuthOptions) => {
    resolvedOptions = betterAuthOptions

    return factory(betterAuthOptions)
  }
}
