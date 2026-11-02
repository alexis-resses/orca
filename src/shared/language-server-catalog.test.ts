import { describe, expect, it } from 'vitest'
import { LANGUAGE_SERVER_CATALOG, workspaceConfigurationFor } from './language-server-catalog'

describe('workspaceConfigurationFor', () => {
  it('excludes the Symfony cache from Intelephense indexing and turns diagnostics off', () => {
    const config = workspaceConfigurationFor('intelephense')
    expect(config.intelephense).toMatchObject({
      diagnostics: { enable: false },
      files: { exclude: expect.arrayContaining(['**/var/cache/**', '**/vendor/**/vendor/**']) }
    })
  })

  it('answers nothing for servers that read their settings elsewhere', () => {
    expect(workspaceConfigurationFor('typescript')).toEqual({})
    expect(workspaceConfigurationFor('phpactor')).toEqual({})
  })
})

describe('phpactor initialization options', () => {
  it('keeps vendor indexed but excludes the Symfony cache', () => {
    const entry = LANGUAGE_SERVER_CATALOG.phpactor
    const options = entry.kind === 'external' ? entry.initializationOptions : null
    expect(options).toMatchObject({
      'language_server_worse_reflection.diagnostics.enable': false,
      'indexer.exclude_patterns': expect.arrayContaining(['/var/cache/**/*'])
    })
    expect(JSON.stringify(options)).not.toContain('"/vendor/**/*"')
  })
})
