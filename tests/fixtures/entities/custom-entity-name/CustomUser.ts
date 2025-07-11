import {Entity, type Opt, Property, Unique} from "@mikro-orm/core"
import type {User as DatabaseUser} from "better-auth"

import {Base} from "../shared/Base.js"

@Entity()
export class CustomUser extends Base implements DatabaseUser {
  @Property({type: "string"})
  @Unique()
  email!: string

  @Property({type: "boolean"})
  emailVerified: Opt<boolean> = false

  @Property({type: "string"})
  name!: string
}
