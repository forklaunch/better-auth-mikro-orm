import {type Opt, PrimaryKey, Property} from "@mikro-orm/core"
import {v7} from "uuid"

export abstract class Base {
  @PrimaryKey({type: "string"})
  id: string = v7()

  @Property({type: Date})
  createdAt: Opt<Date> = new Date()

  @Property({type: Date, onUpdate: () => new Date()})
  updatedAt: Opt<Date> = new Date()
}
