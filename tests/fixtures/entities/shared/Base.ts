import {p} from "@mikro-orm/core"
import {v7} from "uuid"

export const BaseProperties = {
  id: p
    .string()
    .primary()
    .onCreate(() => v7()),
  createdAt: p.datetime().onCreate(() => new Date()),
  updatedAt: p
    .datetime()
    .onCreate(() => new Date())
    .onUpdate(() => new Date())
}
