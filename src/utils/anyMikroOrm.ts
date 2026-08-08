import type {MikroORM} from "@mikro-orm/core"

/**
 * A MikroORM instance regardless of its driver, entity-manager or entities
 * generics.
 *
 * Derived from `MikroORM.init` rather than written as a bare `MikroORM`: the
 * class's `Entities` parameter is constrained `readonly` but defaults to a
 * mutable array, so since MikroORM 7.1 the instances `init` hands back are
 * not assignable to the bare class type. Deriving from `init` keeps this in
 * step with whichever MikroORM version the consumer resolves.
 */
export type AnyMikroOrm = Awaited<ReturnType<typeof MikroORM.init>>
