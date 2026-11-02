import { describe, expect, it } from 'vitest'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import { createWslUriMapper, type WslUriMapper } from './lsp-wsl-uri-mapper'
import type { JsonRpcMessage } from './lsp-message-router'

const ROOT = '\\\\wsl.localhost\\Ubuntu\\home\\me\\proj'
const CLIENT_FILE = 'file://wsl.localhost/Ubuntu/home/me/proj/src/Kernel.php'
const SERVER_FILE = 'file:///home/me/proj/src/Kernel.php'

function mapper(rootPath = ROOT): WslUriMapper {
  const created = createWslUriMapper(rootPath)
  if (!created) {
    throw new Error(`no mapper for ${rootPath}`)
  }
  return created
}

function request(params: unknown): JsonRpcMessage {
  return { jsonrpc: '2.0', id: 1, method: 'textDocument/definition', params }
}

function response(result: unknown): JsonRpcMessage {
  return { jsonrpc: '2.0', id: 1, result }
}

function serverUri(uri: string, rootPath = ROOT): unknown {
  const { params } = mapper(rootPath).toServer(request({ textDocument: { uri } }))
  return isRecord(params) && isRecord(params.textDocument) ? params.textDocument.uri : undefined
}

function clientUri(uri: string, rootPath = ROOT): unknown {
  return mapper(rootPath).toClient(response([{ uri }])).result
}

describe('createWslUriMapper', () => {
  it.each([
    ['a Linux path', '/home/me/proj'],
    ['a drive path', 'C:\\repo'],
    ['a non-WSL UNC share', '\\\\server\\share\\repo']
  ])('returns null for %s', (_label, rootPath) => {
    expect(createWslUriMapper(rootPath)).toBeNull()
  })

  it.each([
    ['wsl.localhost', ROOT],
    ['wsl$', '\\\\wsl$\\Ubuntu\\home\\me\\proj'],
    ['forward slashes', '//wsl.localhost/Ubuntu/home/me/proj']
  ])('accepts a root spelled with %s', (_label, rootPath) => {
    expect(createWslUriMapper(rootPath)).not.toBeNull()
  })
})

describe('toServer', () => {
  it.each([
    ['initialize rootUri', request({ rootUri: CLIENT_FILE }), { rootUri: SERVER_FILE }],
    [
      'initialize workspaceFolders',
      request({ workspaceFolders: [{ uri: CLIENT_FILE, name: 'proj' }] }),
      { workspaceFolders: [{ uri: SERVER_FILE, name: 'proj' }] }
    ],
    [
      'didOpen textDocument.uri',
      request({ textDocument: { uri: CLIENT_FILE, languageId: 'php', text: 'x' } }),
      { textDocument: { uri: SERVER_FILE, languageId: 'php', text: 'x' } }
    ],
    [
      'definition textDocument.uri',
      request({ textDocument: { uri: CLIENT_FILE }, position: { line: 1, character: 2 } }),
      { textDocument: { uri: SERVER_FILE }, position: { line: 1, character: 2 } }
    ],
    [
      'references textDocument.uri',
      request({ textDocument: { uri: CLIENT_FILE }, context: { includeDeclaration: true } }),
      { textDocument: { uri: SERVER_FILE }, context: { includeDeclaration: true } }
    ],
    [
      'workspace/workspaceFolders response',
      response([{ uri: CLIENT_FILE, name: 'proj' }]),
      undefined
    ]
  ])('rewrites %s', (_label, message, expectedParams) => {
    const mapped = mapper().toServer(message)
    if (expectedParams) {
      expect(mapped.params).toEqual(expectedParams)
    } else {
      expect(mapped.result).toEqual([{ uri: SERVER_FILE, name: 'proj' }])
    }
  })

  it('leaves workspace/symbol queries untouched', () => {
    const message = request({ query: 'file://wsl.localhost/Ubuntu/x' })
    expect(mapper().toServer(message)).toEqual(message)
  })

  it('does not rewrite strings under other keys', () => {
    const message = request({
      textDocument: { uri: CLIENT_FILE, text: CLIENT_FILE },
      contents: CLIENT_FILE
    })
    const mapped = mapper().toServer(message)
    expect(mapped.params).toEqual({
      textDocument: { uri: SERVER_FILE, text: CLIENT_FILE },
      contents: CLIENT_FILE
    })
  })

  it('does not translate client-only keys', () => {
    const message = response({ targetUri: CLIENT_FILE, scopeUri: CLIENT_FILE })
    expect(mapper().toServer(message)).toEqual(message)
  })

  it('handles the wsl$ share spelling', () => {
    expect(serverUri('file://wsl%24/Ubuntu/home/me/proj/a.php')).toBe('file:///home/me/proj/a.php')
  })

  it('matches the distro without case, with a wsl$ root as well', () => {
    expect(serverUri('file://wsl.localhost/ubuntu/home/me/a.php')).toBe('file:///home/me/a.php')
    expect(
      serverUri('file://wsl.localhost/UBUNTU/home/me/a.php', '\\\\wsl$\\Ubuntu\\home\\me\\proj')
    ).toBe('file:///home/me/a.php')
  })

  it('leaves another distro untouched', () => {
    const uri = 'file://wsl.localhost/Debian/home/me/a.php'
    expect(serverUri(uri)).toBe(uri)
  })

  it('decodes and re-encodes spaces and accents', () => {
    expect(serverUri('file://wsl.localhost/Ubuntu/home/me/a%20b/%C3%A9%5B1%5D.php')).toBe(
      'file:///home/me/a%20b/%C3%A9%5B1%5D.php'
    )
  })

  it('keeps query and fragment', () => {
    expect(serverUri(`${CLIENT_FILE}?x=1#owner-7`)).toBe(`${SERVER_FILE}?x=1#owner-7`)
    expect(serverUri(`${CLIENT_FILE}#owner-7`)).toBe(`${SERVER_FILE}#owner-7`)
  })

  it('maps a drive path to /mnt', () => {
    expect(serverUri('file:///C:/Users/me/a.php')).toBe('file:///mnt/c/Users/me/a.php')
  })

  it('maps the share root of the distro to /', () => {
    expect(serverUri('file://wsl.localhost/Ubuntu/')).toBe('file:///')
  })

  it.each([
    ['a non-file scheme', 'untitled:Untitled-1'],
    ['a non-WSL UNC share', 'file://server/share/a.php'],
    ['a Linux-style file URI', 'file:///home/me/a.php'],
    ['an unparseable value', 'not a uri'],
    ['an empty string', '']
  ])('leaves %s untouched', (_label, uri) => {
    expect(serverUri(uri)).toBe(uri)
  })

  it('ignores non-string uri values and primitives', () => {
    const message = request({ rootUri: null, textDocument: { uri: 3 }, list: ['a', 1, null] })
    expect(mapper().toServer(message)).toEqual(message)
  })

  it('handles messages without params, results or ids', () => {
    expect(mapper().toServer({ jsonrpc: '2.0', method: 'initialized' })).toEqual({
      jsonrpc: '2.0',
      method: 'initialized'
    })
    expect(mapper().toServer({ jsonrpc: '2.0', id: 2, result: null })).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: null
    })
  })

  it('returns a copy and never mutates the input', () => {
    const message = request({ textDocument: { uri: CLIENT_FILE } })
    const mapped = mapper().toServer(message)
    expect(mapped).not.toBe(message)
    expect(message.params).toEqual({ textDocument: { uri: CLIENT_FILE } })
  })
})

describe('toClient', () => {
  it.each([
    ['Location', response({ uri: SERVER_FILE, range: { start: { line: 1 } } })],
    ['Location[]', response([{ uri: SERVER_FILE }])],
    [
      'LocationLink[]',
      response([{ targetUri: SERVER_FILE, originSelectionRange: { start: { line: 0 } } }])
    ],
    ['SymbolInformation[]', response([{ name: 'K', location: { uri: SERVER_FILE } }])],
    [
      'WorkspaceSymbol without range',
      response([
        { name: 'K', location: { uri: SERVER_FILE } },
        { name: 'L', kind: 5 }
      ])
    ],
    ['workspace/configuration scopeUri', request({ items: [{ scopeUri: SERVER_FILE }] })]
  ])('rewrites %s', (_label, message) => {
    const mapped = JSON.stringify(mapper().toClient(message))
    expect(mapped).toContain(CLIENT_FILE)
    expect(mapped).not.toContain(SERVER_FILE)
  })

  it('does not translate server-only keys or hover text', () => {
    const message = response({ rootUri: SERVER_FILE, contents: { value: `[a](${SERVER_FILE})` } })
    expect(mapper().toClient(message)).toEqual(message)
  })

  it('reuses the share and distro casing of the root', () => {
    const root = '\\\\WSL$\\ubuntu\\home\\me\\proj'
    expect(clientUri(SERVER_FILE, root)).toEqual([
      { uri: 'file://wsl%24/ubuntu/home/me/proj/src/Kernel.php' }
    ])
    expect(clientUri('file:///etc/php.ini', root)).toEqual([
      { uri: 'file://wsl%24/ubuntu/etc/php.ini' }
    ])
  })

  it('maps a path outside the root through the distro', () => {
    expect(clientUri('file:///home/me/.config/stubs/Core.php')).toEqual([
      { uri: 'file://wsl.localhost/Ubuntu/home/me/.config/stubs/Core.php' }
    ])
  })

  it('does not treat a sibling directory as under the root', () => {
    expect(clientUri('file:///home/me/proj-other/a.php')).toEqual([
      { uri: 'file://wsl.localhost/Ubuntu/home/me/proj-other/a.php' }
    ])
  })

  it('maps /mnt/<x> outside the root to a drive path', () => {
    expect(clientUri('file:///mnt/c/Users/me/a.php')).toEqual([
      { uri: 'file:///C:/Users/me/a.php' }
    ])
    expect(clientUri('file:///mnt/d')).toEqual([{ uri: 'file:///D:/' }])
  })

  it('keeps /mnt/<x> under the root on the distro share', () => {
    expect(
      clientUri('file:///mnt/c/proj/a.php', '\\\\wsl.localhost\\Ubuntu\\mnt\\c\\proj')
    ).toEqual([{ uri: 'file://wsl.localhost/Ubuntu/mnt/c/proj/a.php' }])
  })

  it('treats a root at / as containing everything', () => {
    expect(clientUri('file:///mnt/c/a.php', '\\\\wsl.localhost\\Ubuntu')).toEqual([
      { uri: 'file://wsl.localhost/Ubuntu/mnt/c/a.php' }
    ])
  })

  it('ignores a trailing separator on the root', () => {
    expect(clientUri(SERVER_FILE, `${ROOT}\\`)).toEqual([{ uri: CLIENT_FILE }])
  })

  it('maps the root directory and / itself', () => {
    expect(clientUri('file:///home/me/proj')).toEqual([
      { uri: 'file://wsl.localhost/Ubuntu/home/me/proj' }
    ])
    expect(clientUri('file:///')).toEqual([{ uri: 'file://wsl.localhost/Ubuntu/' }])
  })

  it('encodes spaces and accents, and keeps query and fragment', () => {
    expect(clientUri('file:///home/me/a%20b/%C3%A9.php?x=1#frag')).toEqual([
      { uri: 'file://wsl.localhost/Ubuntu/home/me/a%20b/%C3%A9.php?x=1#frag' }
    ])
  })

  it.each([
    ['a non-file scheme', 'untitled:Untitled-1'],
    ['an already-Windows UNC URI', 'file://wsl.localhost/Ubuntu/home/me/a.php'],
    ['an unparseable value', '::'],
    ['a remote host', 'file://server/share/a.php']
  ])('leaves %s untouched', (_label, uri) => {
    expect(clientUri(uri)).toEqual([{ uri }])
  })

  it('handles messages without params or result', () => {
    expect(mapper().toClient({ jsonrpc: '2.0', method: 'exit' })).toEqual({
      jsonrpc: '2.0',
      method: 'exit'
    })
  })
})

describe('round trip', () => {
  it.each([
    CLIENT_FILE,
    'file://wsl.localhost/Ubuntu/home/me/proj/a%20b/%C3%A9.php',
    `${CLIENT_FILE}#owner`,
    'file://wsl.localhost/Ubuntu/home/me/other/b.php'
  ])('returns the same URI for %s', (uri) => {
    const roundTripped = mapper().toClient(mapper().toServer(request({ textDocument: { uri } })))
    expect(roundTripped.params).toEqual({ textDocument: { uri } })
  })

  it('returns the same decoded path through the wsl$ spelling', () => {
    const root = '\\\\wsl$\\Ubuntu\\home\\me\\proj'
    const uri = 'file://wsl%24/Ubuntu/home/me/proj/a%20b.php'
    const toServer = mapper(root).toServer(request({ textDocument: { uri } }))
    const back = mapper(root).toClient(response(toServer.params))
    expect(back.result).toEqual({ textDocument: { uri } })
  })
})
