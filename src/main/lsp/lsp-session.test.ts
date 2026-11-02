import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnProcess } from '@orca/process-host'
import type { PipedChildProcess, PipedProcessSpec } from '@orca/process-host/process-spec'
import { LspSession, type LspPort, type LspSessionConfig } from './lsp-session'

const FAKE_SERVER = fileURLToPath(
  new URL('./__fixtures__/fake-language-server.mjs', import.meta.url)
)

function fakePort() {
  const sent: unknown[] = []
  let messageListener: (data: unknown) => void = () => {}
  let closeListener: () => void = () => {}
  const port: LspPort = {
    post: (m) => sent.push(m),
    onMessage: (listener) => {
      messageListener = listener
    },
    onClose: (listener) => {
      closeListener = listener
    },
    close: vi.fn()
  }
  return { port, sent, send: (m: unknown) => messageListener(m), disconnect: () => closeListener() }
}

const sessions: LspSession[] = []
const recordDirs: string[] = []
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.dispose({ force: true })))
  for (const dir of recordDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function startSession(overrides: Partial<LspSessionConfig> = {}) {
  const onExit = vi.fn()
  const session = new LspSession({
    serverId: 'typescript',
    rootPath: tmpdir(),
    command: { program: process.execPath, args: [FAKE_SERVER], env: process.env },
    initializationOptions: null,
    idleShutdownMs: 50,
    onExit,
    ...overrides
  })
  sessions.push(session)
  return { session, onExit }
}
function recordingCommand() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'orca-lsp-session-')))
  recordDirs.push(dir)
  const recordFile = join(dir, 'record.jsonl')
  return {
    dir,
    command: {
      program: process.execPath,
      args: [FAKE_SERVER],
      env: { ...process.env, FAKE_LSP_RECORD: recordFile }
    },
    received: (): unknown[] =>
      readFileSync(recordFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line): unknown => JSON.parse(line))
  }
}
const WSL_ROOT = '\\\\wsl.localhost\\Ubuntu\\home\\me\\proj'
const CLIENT_ROOT = 'file://wsl.localhost/Ubuntu/home/me/proj'
const SERVER_ROOT = 'file:///home/me/proj'
const request = (id: number, method: string, params: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  params
})
const hover = (id: number) => ({
  jsonrpc: '2.0',
  id,
  method: 'textDocument/hover',
  params: {}
})
const didOpen = (uri: string) => ({
  jsonrpc: '2.0',
  method: 'textDocument/didOpen',
  params: { textDocument: { uri, languageId: 'typescript', version: 1, text: '' } }
})

describe('LspSession', { timeout: 30_000 }, () => {
  it('queues early port messages and answers them after initialize', async () => {
    const { session } = startSession()
    const a = fakePort()
    session.attachPort(a.port)
    a.send(hover(1))
    await vi.waitFor(() => expect(a.sent).toContainEqual(expect.objectContaining({ id: 1 })), {
      timeout: 15_000
    })
    expect(a.sent).toHaveLength(1) // Why: diagnostics from the fixture must not reach the port.
    await session.dispose()
  })

  it('answers the semantic tokens legend from initialize and forwards token requests', async () => {
    const { session } = startSession()
    const a = fakePort()
    session.attachPort(a.port)
    a.send({ jsonrpc: '2.0', id: 1, method: 'orca/semanticTokensLegend' })
    a.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/semanticTokens/full',
      params: { textDocument: { uri: 'file:///a.rb' } }
    })
    await vi.waitFor(() => expect(a.sent).toHaveLength(2), { timeout: 15_000 })
    expect(a.sent).toContainEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tokenTypes: ['variable', 'method'], tokenModifiers: ['declaration'] }
    })
    expect(a.sent).toContainEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { resultId: 'r1', data: [0, 0, 3, 1, 1] }
    })
    await session.dispose()
  })

  it("closes a disconnected port's documents on the server", async () => {
    const { session } = startSession()
    const a = fakePort()
    const b = fakePort()
    session.attachPort(a.port)
    session.attachPort(b.port)
    a.send(didOpen('file:///a.ts'))
    b.send(hover(1))
    await vi.waitFor(
      () =>
        expect(b.sent).toContainEqual(
          expect.objectContaining({ result: { contents: { kind: 'markdown', value: 'open:1' } } })
        ),
      { timeout: 15_000 }
    )
    a.disconnect()
    b.send(hover(2))
    await vi.waitFor(
      () =>
        expect(b.sent).toContainEqual(
          expect.objectContaining({
            id: 2,
            result: { contents: { kind: 'markdown', value: 'open:0' } }
          })
        ),
      { timeout: 15_000 }
    )
    await session.dispose()
  })

  it('shuts down after the idle timeout once the last port closes', async () => {
    const { session, onExit } = startSession()
    const a = fakePort()
    session.attachPort(a.port)
    await session.ready
    a.disconnect()
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(false), { timeout: 15_000 })
  })

  it('reports an unexpected exit and closes its ports', async () => {
    const children: PipedChildProcess[] = []
    const { session, onExit } = startSession({
      spawn: (spec: PipedProcessSpec) => {
        const child = spawnProcess(spec)
        children.push(child)
        return child
      }
    })
    const a = fakePort()
    session.attachPort(a.port)
    await session.ready
    children[0]?.kill('SIGKILL')
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(true), { timeout: 15_000 })
    expect(a.port.close).toHaveBeenCalled()
  })

  it('survives repeated error events on a live child without exiting', async () => {
    const children: PipedChildProcess[] = []
    const { session, onExit } = startSession({
      spawn: (spec: PipedProcessSpec) => {
        const child = spawnProcess(spec)
        children.push(child)
        return child
      }
    })
    await session.ready
    const child = children[0]
    expect(() => {
      child?.emit('error', new Error('kill failed 1'))
      child?.emit('error', new Error('kill failed 2'))
    }).not.toThrow()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('drops queued messages of a port that disconnects before initialize', async () => {
    const { session } = startSession()
    const a = fakePort()
    const b = fakePort()
    session.attachPort(a.port)
    session.attachPort(b.port)
    a.send(didOpen('file:///a.ts'))
    a.disconnect()
    b.send(hover(1))
    await vi.waitFor(
      () =>
        expect(b.sent).toContainEqual(
          expect.objectContaining({
            id: 1,
            result: { contents: { kind: 'markdown', value: 'open:0' } }
          })
        ),
      { timeout: 15_000 }
    )
  })

  it('reports a failed start as an unexpected exit exactly once', async () => {
    const { session, onExit } = startSession({
      command: { program: process.execPath, args: ['-e', 'process.exit(1)'], env: process.env }
    })
    await session.ready.catch(() => undefined)
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(true), { timeout: 15_000 })
    await session.dispose()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('closes a port attached after disposal', async () => {
    const { session } = startSession()
    await session.dispose({ force: true })
    const a = fakePort()
    session.attachPort(a.port)
    expect(a.port.close).toHaveBeenCalled()
  })

  it('logs the exit code and stderr tail once when the server dies at startup', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const script = "process.stderr.write('x'.repeat(10000) + 'boom-tail'); process.exit(3)"
    const { session, onExit } = startSession({
      command: { program: process.execPath, args: ['-e', script], env: process.env },
      // Why: under load a 50ms idle shutdown can beat the crash and turn it into an orderly dispose.
      idleShutdownMs: 60_000
    })
    await session.ready.catch(() => undefined)
    await vi.waitFor(() => expect(warn).toHaveBeenCalled(), { timeout: 15_000 })
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(true), { timeout: 15_000 })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).toContain('[lsp] typescript language server for')
    expect(message).toContain(tmpdir())
    expect(message).toContain('exited with code 3')
    expect(message).toMatch(/boom-tail$/)
    expect(message.length).toBeLessThan(4_096 + 200)
    warn.mockRestore()
  })

  it('does not log on an orderly shutdown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { session } = startSession()
    await session.ready
    await session.dispose()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('shuts down after the idle timeout when no port is ever attached', async () => {
    const { onExit } = startSession()
    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(false), { timeout: 15_000 })
  })

  it('keeps a session whose port attaches before the idle timeout', async () => {
    const { session, onExit } = startSession()
    session.attachPort(fakePort().port)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(onExit).not.toHaveBeenCalled()
  })

  it('translates URIs at the WSL session boundary and starts in the command cwd', async () => {
    const recording = recordingCommand()
    const { session } = startSession({
      serverId: 'intelephense',
      rootPath: WSL_ROOT,
      command: { ...recording.command, cwd: recording.dir },
      wsl: { distro: 'Ubuntu', linuxRoot: '/home/me/proj' },
      idleShutdownMs: 60_000
    })
    const a = fakePort()
    session.attachPort(a.port)
    const clientFile = `${CLIENT_ROOT}/src/Kernel.php`
    const textDocument = { uri: clientFile }
    const position = { line: 0, character: 0 }
    a.send(didOpen(clientFile))
    a.send(request(1, 'textDocument/definition', { textDocument, position }))
    a.send(request(2, 'textDocument/references', { textDocument, position, context: {} }))
    a.send(request(3, 'workspace/symbol', { query: 'Kernel' }))
    await vi.waitFor(() => expect(a.sent).toHaveLength(3), { timeout: 15_000 })
    expect(a.sent).toContainEqual(
      expect.objectContaining({ id: 1, result: expect.objectContaining({ uri: clientFile }) })
    )
    expect(a.sent).toContainEqual(
      expect.objectContaining({
        id: 2,
        result: [
          expect.objectContaining({ uri: clientFile }),
          expect.objectContaining({ uri: 'file://wsl.localhost/Ubuntu/usr/share/php/Vendor.php' })
        ]
      })
    )
    expect(a.sent).toContainEqual(
      expect.objectContaining({
        id: 3,
        result: [
          expect.objectContaining({ location: expect.objectContaining({ uri: clientFile }) })
        ]
      })
    )
    a.disconnect()
    const serverFile = `${SERVER_ROOT}/src/Kernel.php`
    const serverFolders = [{ uri: SERVER_ROOT, name: 'proj' }]
    await vi.waitFor(
      () => {
        expect(recording.received()).toContainEqual({ didClose: serverFile })
        expect(recording.received()).toContainEqual({ workspaceFolders: serverFolders })
      },
      { timeout: 15_000 }
    )
    const received = recording.received()
    expect(received).toContainEqual({ cwd: recording.dir })
    expect(received).toContainEqual({ didOpen: serverFile })
    expect(received).toContainEqual({ workspaceFolders: serverFolders })
    expect(received).toContainEqual({
      initialize: expect.objectContaining({
        processId: null,
        rootUri: SERVER_ROOT,
        workspaceFolders: serverFolders
      })
    })
  })

  it('keeps native sessions untranslated, in the root cwd, with the Orca pid', async () => {
    const recording = recordingCommand()
    const { session } = startSession({ command: recording.command, idleShutdownMs: 60_000 })
    const a = fakePort()
    session.attachPort(a.port)
    a.send(didOpen('file:///a.ts'))
    a.send(request(1, 'textDocument/definition', { textDocument: { uri: 'file:///a.ts' } }))
    await vi.waitFor(() => expect(a.sent).toHaveLength(1), { timeout: 15_000 })
    expect(a.sent[0]).toMatchObject({ id: 1, result: { uri: 'file:///a.ts' } })
    const rootUri = pathToFileURL(tmpdir()).toString()
    const received = recording.received()
    expect(received).toContainEqual({ cwd: realpathSync(tmpdir()) })
    expect(received).toContainEqual({ didOpen: 'file:///a.ts' })
    expect(received).toContainEqual({
      initialize: expect.objectContaining({ processId: process.pid, rootUri })
    })
  })

  it('does not translate a UNC root without WSL launch info', async () => {
    const recording = recordingCommand()
    const { session } = startSession({
      rootPath: WSL_ROOT,
      command: { ...recording.command, cwd: recording.dir },
      idleShutdownMs: 60_000
    })
    const a = fakePort()
    session.attachPort(a.port)
    const clientFile = `${CLIENT_ROOT}/src/a.ts`
    a.send(didOpen(clientFile))
    a.send(request(1, 'textDocument/definition', { textDocument: { uri: clientFile } }))
    await vi.waitFor(() => expect(a.sent).toHaveLength(1), { timeout: 15_000 })
    expect(a.sent[0]).toMatchObject({ id: 1, result: { uri: clientFile } })
    expect(recording.received()).toContainEqual({ didOpen: clientFile })
    expect(recording.received()).toContainEqual({
      initialize: expect.objectContaining({ processId: process.pid })
    })
  })
})
