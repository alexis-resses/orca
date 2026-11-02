import { LANGUAGE_SERVER_CATALOG } from '../../../../shared/language-server-catalog'
import { LANGUAGE_SERVER_IDS } from '../../../../shared/language-server-types'
import type { LanguageServerId } from '../../../../shared/language-server-types'

export type LanguageServerChoiceGroup = {
  languageId: string
  serverIds: LanguageServerId[]
}

export function getLanguageServerChoiceGroups(): LanguageServerChoiceGroup[] {
  const groups = new Map<string, LanguageServerChoiceGroup>()
  for (const serverId of LANGUAGE_SERVER_IDS) {
    const entry = LANGUAGE_SERVER_CATALOG[serverId]
    if (entry.kind !== 'external') {
      continue
    }
    const groupKey = entry.languageIds.join(',')
    const group = groups.get(groupKey) ?? { languageId: entry.languageIds[0], serverIds: [] }
    group.serverIds.push(serverId)
    groups.set(groupKey, group)
  }
  return [...groups.values()]
}
