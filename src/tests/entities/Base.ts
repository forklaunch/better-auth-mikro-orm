import {type Opt, PrimaryKey, Property} from "@mikro-orm/core"

export abstract class Base {
  @PrimaryKey({type: "string"})
  id: string = crypto.randomUUID()

  @Property({type: Date})
  createdAt: Opt<Date> = new Date()

  @Property({type: Date, onUpdate: () => new Date()})
  updatedAt: Opt<Date> = new Date()
}
