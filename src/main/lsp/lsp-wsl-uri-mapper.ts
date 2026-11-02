import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import { parseWslUncPath, toLinuxPath, toWindowsWslDrivePath } from '../../shared/wsl-paths'
import type { JsonRpcMessage } from './lsp-message-router'

export type WslUriMapper = {
  clientRootUri: string
  toServer(message: JsonRpcMessage): JsonRpcMessage
  toClient(message: JsonRpcMessage): JsonRpcMessage
}

const SERVER_URI_KEYS: ReadonlySet<string> = new Set(['uri', 'rootUri'])
const CLIENT_URI_KEYS: ReadonlySet<string> = new Set(['uri', 'targetUri', 'scopeUri'])
const WINDOWS_DRIVE_URI_PATH = /^\/([A-Za-z]:\/.*)$/

function rewriteUriKeys(
  value: unknown,
  uriKeys: ReadonlySet<string>,
  convert: (uri: string) => string
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rewriteUriKeys(item, uriKeys, convert)
    }
    return
  }
  if (!isRecord(value)) {
    return
  }
  for (const key of Object.keys(value)) {
    const child = value[key]
    if (typeof child === 'string' && uriKeys.has(key)) {
      value[key] = convert(child)
    } else {
      rewriteUriKeys(child, uriKeys, convert)
    }
  }
}

function encodePathSegments(segments: readonly string[]): string {
  return segments.map(encodeURIComponent).join('/')
}

type ParsedFileUri = { host: string; path: string; suffix: string }

// Why: node:url's `windows` option is not honored by every runtime the tests run on, so the
// URI shape is built by hand and stays identical on every platform.
function parseFileUri(uri: string): ParsedFileUri | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'file:') {
      return null
    }
    return {
      host: decodeURIComponent(url.hostname),
      path: decodeURIComponent(url.pathname),
      suffix: `${url.search}${url.hash}`
    }
  } catch {
    return null
  }
}

function linuxPathFromWindowsFileUri({ host, path }: ParsedFileUri, distro: string): string | null {
  const unc = host ? parseWslUncPath(`//${host}${path}`) : null
  if (unc) {
    return unc.distro.toLowerCase() === distro.toLowerCase() ? unc.linuxPath : null
  }
  const drivePath = host ? null : WINDOWS_DRIVE_URI_PATH.exec(path)?.[1]
  const linuxPath = drivePath ? toLinuxPath(drivePath) : null
  return linuxPath === drivePath ? null : linuxPath
}

function isUnderLinuxRoot(linuxPath: string, linuxRoot: string): boolean {
  return linuxRoot === '/' || linuxPath === linuxRoot || linuxPath.startsWith(`${linuxRoot}/`)
}

export function createWslUriMapper(rootPath: string): WslUriMapper | null {
  const root = parseWslUncPath(rootPath)
  if (!root) {
    return null
  }
  const { distro } = root
  const share = rootPath.replace(/\\/g, '/').split('/')[2].toLowerCase()
  const linuxRoot = root.linuxPath.replace(/\/+$/, '') || '/'

  const windowsFileUriFor = (linuxPath: string): string => {
    const drivePath = isUnderLinuxRoot(linuxPath, linuxRoot)
      ? null
      : toWindowsWslDrivePath(linuxPath)
    if (drivePath) {
      const [drive, ...rest] = drivePath.split('\\')
      return `file:///${drive}/${encodePathSegments(rest)}`
    }
    // Why: Monaco keys models by URI, so share and distro casing must match the repo path.
    return `file://${encodeURIComponent(share)}/${encodeURIComponent(distro)}${encodePathSegments(linuxPath.split('/'))}`
  }

  const uriToServer = (uri: string): string => {
    const parsed = parseFileUri(uri)
    const linuxPath = parsed && linuxPathFromWindowsFileUri(parsed, distro)
    return parsed && linuxPath
      ? `file://${encodePathSegments(linuxPath.split('/'))}${parsed.suffix}`
      : uri
  }

  const uriToClient = (uri: string): string => {
    const parsed = parseFileUri(uri)
    return parsed && !parsed.host ? `${windowsFileUriFor(parsed.path)}${parsed.suffix}` : uri
  }

  const mapMessage = (
    message: JsonRpcMessage,
    uriKeys: ReadonlySet<string>,
    convert: (uri: string) => string
  ): JsonRpcMessage => {
    const copy = structuredClone(message)
    rewriteUriKeys(copy, uriKeys, convert)
    return copy
  }

  return {
    clientRootUri: windowsFileUriFor(linuxRoot),
    toServer: (message) => mapMessage(message, SERVER_URI_KEYS, uriToServer),
    toClient: (message) => mapMessage(message, CLIENT_URI_KEYS, uriToClient)
  }
}
