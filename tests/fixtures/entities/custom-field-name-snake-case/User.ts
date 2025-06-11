import {Entity, type Opt, Property, Unique} from "@mikro-orm/core"
import type {User as DatabaseUser} from "better-auth"

import {Base} from "../shared/Base.js"

@Entity()
export class User extends Base implements Omit<DatabaseUser, "email"> {
  @Property({type: "string"})
  @Unique()
  email_address!: string

  @Property({type: "boolean"})
  emailVerified: Opt<boolean> = false

  @Property({type: "string"})
  name!: string
}
