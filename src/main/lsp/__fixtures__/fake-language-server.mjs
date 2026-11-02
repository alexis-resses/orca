import { appendFileSync } from 'node:fs'
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-jsonrpc/node'

const connection = createMessageConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout)
)
const opened = new Set()
const recordPath = process.env.FAKE_LSP_RECORD
const record = (entry) => {
  if (recordPath) {
    appendFileSync(recordPath, `${JSON.stringify(entry)}\n`)
  }
}
record({ cwd: process.cwd() })
let rootUri = ''
connection.onRequest('initialize', (params) => {
  record({ initialize: params })
  rootUri = params.rootUri
  return {
    capabilities: {
      definitionProvider: true,
      referencesProvider: true,
      hoverProvider: true,
      workspaceSymbolProvider: true,
      semanticTokensProvider: {
        legend: { tokenTypes: ['variable', 'method'], tokenModifiers: ['declaration'] },
        full: true
      }
    }
  }
})
connection.onNotification('initialized', async () => {
  await connection.sendRequest('workspace/configuration', { items: [{ section: 'x' }] })
  record({ workspaceFolders: await connection.sendRequest('workspace/workspaceFolders') })
  connection.sendNotification('textDocument/publishDiagnostics', {
    uri: 'file:///x',
    diagnostics: []
  })
})
connection.onNotification('textDocument/didOpen', (p) => {
  record({ didOpen: p.textDocument.uri })
  opened.add(p.textDocument.uri)
})
connection.onNotification('textDocument/didClose', (p) => {
  record({ didClose: p.textDocument.uri })
  opened.delete(p.textDocument.uri)
})
connection.onRequest('textDocument/hover', () => ({
  contents: { kind: 'markdown', value: `open:${opened.size}` }
}))
connection.onRequest('textDocument/definition', (p) => ({
  uri: p.textDocument.uri,
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }
}))
connection.onRequest('textDocument/references', (p) => [
  {
    uri: p.textDocument.uri,
    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } }
  },
  {
    uri: 'file:///usr/share/php/Vendor.php',
    range: { start: { line: 2, character: 0 }, end: { line: 2, character: 3 } }
  }
])
connection.onRequest('workspace/symbol', (p) => [
  {
    name: p.query,
    kind: 5,
    location: {
      uri: `${rootUri}/src/Kernel.php`,
      range: { start: { line: 3, character: 0 }, end: { line: 3, character: 3 } }
    }
  }
])
connection.onRequest('textDocument/semanticTokens/full', () => ({
  resultId: 'r1',
  data: [0, 0, 3, 1, 1]
}))
connection.onRequest('shutdown', () => null)
connection.onNotification('exit', () => process.exit(0))
connection.listen()
