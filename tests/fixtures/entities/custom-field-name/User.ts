import type {User as DatabaseUser} from "@forklaunch/better-auth"
import {Entity, type Opt, Property, Unique} from "@mikro-orm/core"

import {Base} from "../shared/Base.js"

@Entity()
export class User extends Base implements Omit<DatabaseUser, "email"> {
  @Property({type: "string"})
  @Unique()
  emailAddress!: string

  @Property({type: "boolean"})
  emailVerified: Opt<boolean> = false

  @Property({type: "string"})
  name!: string
}
