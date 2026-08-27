import type {FindOptions} from "@mikro-orm/core"
import {
  type AdapterFactoryCustomizeAdapterCreator,
  createAdapterFactory
} from "better-auth/adapters"
import type {BetterAuthOptions, Where} from "better-auth/types"
import {dset} from "dset"
import {createAdapterUtils} from "./utils/adapterUtils.js"
import type {AnyMikroOrm} from "./utils/anyMikroOrm.js"

export type {AnyMikroOrm} from "./utils/anyMikroOrm.js"

export interface MikroOrmAdapterConfig {
  /**
   * Enable debug logs.
   *
   * @default false
   */
  debugLogs?:
    | boolean
    | {isRunningAdapterTests: boolean}
    | {logCondition?: () => boolean}

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
  orm =>
  ({options}) => {
    const {
      getEntityMetadata,
      getFieldPath,
      normalizeInput,
      normalizeOutput,
      normalizeWhereClauses
    } = createAdapterUtils(orm)

    return {
      async create({model, data, select}) {
        const metadata = getEntityMetadata(model)
        const input = normalizeInput(metadata, data)

        // Better Auth ignores `advanced.generateId` option when it's disabled, so this needs to be taken care of (for backwards compatibility)
        if (options.advanced?.database?.generateId === false) {
          Reflect.deleteProperty(input, "id")
        }

        const entity = orm.em.create(metadata.class, input)

        try {
          await orm.em.persist(entity).flush()
        } catch (error) {
          await orm.em.remove(entity).flush()
          throw error
        }

        return normalizeOutput(metadata, entity, select) as any
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

        orm.em.assign(entity, normalizeInput(metadata, update as any))

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

      // Guarded conditional update. The `where` is both selector and guard: if
      // no row matches it, nothing is written and null is returned, which is
      // what lets callers use this as a compare-and-set.
      //
      // Two independent payloads arrive, and BOTH are required:
      //
      //   increment - fields to add to, read-modify-write against the current row
      //   set       - fields to assign outright, independent of their old value
      //
      // Handling only `increment` looks sufficient because the method is named
      // for it, but Better Auth calls this with an EMPTY `increment` and a
      // populated `set` whenever it wants a guarded assignment. The device
      // authorization flow is the case that matters most:
      //
      //   incrementOne({
      //     model: "deviceCode",
      //     where: [{id}, {status: "pending"}, {userId: null}],
      //     increment: {},
      //     set: {userId: session.user.id}
      //   })
      //
      // That is how a browser claims a pending CLI login code. Dropping `set`
      // made it a silent no-op: the loop over an empty `increment` produced an
      // empty patch, flush wrote nothing, and the row kept `userId = null` — so
      // the later approve step correctly refused to approve an unclaimed code
      // and CLI login could never complete.
      //
      // Silent is the operative word. The truthy entity returned below tells
      // Better Auth the claim succeeded, so it updates its in-memory copy and
      // reports success while the database row is unchanged. Nothing errors and
      // nothing logs; the failure only surfaces one request later.
      //
      // The same shape is used by the rate limiter, two-factor verification and
      // backup-code redemption, all of which combine a counter with a guarded
      // field assignment.
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
 * @param orm - Instance of Mikro ORM returned from `MikroORM.init` or `new MikroORM` constructor
 * @param config - Additional configuration for Mikro ORM adapter
 */
export const mikroOrmAdapter = (
  orm: AnyMikroOrm,
  {debugLogs, supportsJSON = true, options}: MikroOrmAdapterConfig = {}
) => {
  // Better Auth invokes the returned factory with the fully-resolved auth
  // options (including plugin schemas). The transactional adapter must be
  // built with those same options — building it with `{}` drops every
  // plugin table from the schema, so any transactional write to a plugin
  // model (e.g. the device-authorization claim) throws
  // `Model "<name>" not found in schema`.
  let resolvedOptions: BetterAuthOptions | undefined

  const factory = createAdapterFactory({
    adapter: adapter(orm),
    config: {
      debugLogs,
      supportsJSON,
      adapterId: "mikro-orm-adapter",
      adapterName: "Mikro ORM Adapter",
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
              // with — an explicit `options` config is typically partial
              // (no plugin schemas) and must not shadow them.
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
