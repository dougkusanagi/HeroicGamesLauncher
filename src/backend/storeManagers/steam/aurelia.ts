import { join } from 'path'
import { userInfo } from 'os'
import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'graceful-fs'
import { callRunner } from 'backend/launcher'
import {
  getAureliaBin,
  getFileSize,
  formatTime,
  sendProgressUpdate
} from 'backend/utils'
import { appFolder } from 'backend/constants/paths'
import { logError, logInfo, logWarning, LogPrefix } from 'backend/logger'
import type { CallRunnerOptions, ExecResult, Status } from 'common/types'
import type {
  AureliaAccount,
  AureliaConfigShowResponse,
  AureliaInfoResponse,
  AureliaLibrariesResponse,
  AureliaProgressEvent
} from './aurelia_types'
import type { SteamInstallLibrary } from 'common/types/steam'

export class AureliaError extends Error {
  readonly aborted: boolean
  constructor(message: string, aborted = false) {
    super(message)
    this.name = 'AureliaError'
    this.aborted = aborted
  }
}

/**
 * Runs an `aurelia` command and returns the raw {@link ExecResult}.
 * Keeps Aurelia's session/config/cache under Heroic's own config folder
 */
const aureliaConfigDir = join(appFolder, 'aurelia')

/**
 * Isolated daemon endpoint for Heroic's aurelia commands.
 */
const aureliaDaemonSocket =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\aurelia-heroic-${userInfo().username}`
    : join(aureliaConfigDir, 'daemon.sock')

let daemonEnsured = false

/**
 * Start Aurelia's session daemon
 */
function ensureAureliaDaemon(): void {
  if (daemonEnsured) return
  daemonEnsured = true
  const { dir, bin } = getAureliaBin()
  try {
    const child = spawn(dir ? join(dir, bin) : bin, ['daemon'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        AURELIA_CONFIG_DIR: aureliaConfigDir,
        AURELIA_DAEMON_SOCKET: aureliaDaemonSocket
      }
    })
    child.on('error', (error) =>
      logError(
        ['Unable to start the Aurelia daemon', String(error)],
        LogPrefix.Steam
      )
    )
    child.unref()
  } catch (error) {
    logError(
      ['Unable to start the Aurelia daemon', String(error)],
      LogPrefix.Steam
    )
  }
}

export async function runAureliaCommand(
  commandParts: string[],
  options: CallRunnerOptions = {}
): Promise<ExecResult> {
  ensureAureliaDaemon()
  const { dir, bin } = getAureliaBin()
  return callRunner(
    commandParts,
    { name: 'steam', logPrefix: LogPrefix.Steam, bin, dir },
    {
      ...options,
      env: {
        AURELIA_CONFIG_DIR: aureliaConfigDir,
        AURELIA_DAEMON_SOCKET: aureliaDaemonSocket,
        AURELIA_NO_SPAWN: '1',
        ...options.env
      }
    }
  )
}

/**
 * Runs an `aurelia` command with `--json` and returns its parsed result.
 */
export async function runAurelia<T = unknown>(
  commandParts: string[],
  options: CallRunnerOptions = {}
): Promise<T> {
  const res = await runAureliaCommand([...commandParts, '--json'], options)
  return parseAureliaJson<T>(res)
}

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\[[0-9;]*[A-Za-z]/g

/** Strips ANSI escape sequences (Aurelia's tracing logger colourises output). */
function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '')
}

/**
 * Extracts every top-level JSON value (object/array) found in `text`, in order.
 */
function extractJsonValues(text: string): unknown[] {
  const values: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}' || ch === ']') {
      if (depth > 0) {
        depth--
        if (depth === 0 && start !== -1) {
          try {
            values.push(JSON.parse(text.slice(start, i + 1)))
          } catch {
            // Not valid JSON
          }
          start = -1
        }
      }
    }
  }

  return values
}

/** The last non-empty line of `text`, used to surface plain-text errors. */
function lastNonEmptyLine(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines[lines.length - 1] ?? ''
}

export function parseAureliaJson<T>(res: ExecResult): T {
  if (res.abort) {
    throw new AureliaError('aurelia command was aborted', true)
  }

  // fall back to scanning stderr
  const stdout = stripAnsi(res.stdout)
  const stderr = stripAnsi(res.stderr)
  const stdoutValues = extractJsonValues(stdout)
  const values = stdoutValues.length ? stdoutValues : extractJsonValues(stderr)
  const parsed = values.at(-1)

  if (parsed === undefined) {
    const raw =
      res.error || lastNonEmptyLine(stderr) || lastNonEmptyLine(stdout)
    throw new AureliaError(raw || 'aurelia produced no JSON output')
  }
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'error' in parsed &&
    parsed.error
  ) {
    throw new AureliaError(String(parsed.error))
  }
  return parsed as T
}

/**
 * Builds an `onOutput` handler that forwards Aurelia's NDJSON `progress` events
 * {@link sendProgressUpdate}. Shared by install, update, verify and move
 */
export function makeAureliaProgressHandler(
  appName: string,
  status: Status
): (data: string) => void {
  return (data: string) => {
    for (const rawLine of stripAnsi(data).split('\n')) {
      const line = rawLine.trim()
      if (!line.startsWith('{')) continue

      let evt: AureliaProgressEvent
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (evt.event !== 'progress') continue

      // Match the MiB/s unit the other runners report.
      const downSpeed =
        typeof evt.speed_bps === 'number'
          ? evt.speed_bps / 1024 ** 2
          : undefined
      const eta =
        typeof evt.eta_seconds === 'number'
          ? formatTime(Math.floor(evt.eta_seconds))
          : '--:--:--'

      sendProgressUpdate({
        appName,
        runner: 'steam',
        status,
        progress: {
          bytes: getFileSize(evt.bytes_downloaded ?? 0),
          eta,
          percent:
            typeof evt.percent === 'number'
              ? Math.round(evt.percent * 100) / 100
              : undefined,
          downSpeed,
          diskSpeed: downSpeed,
          file: evt.file
        }
      })
    }
  }
}

export function makeAureliaQrHandler(
  onUrl: (url: string) => void,
  onScanned?: () => void
): (data: string) => void {
  return (data: string) => {
    for (const rawLine of stripAnsi(data).split('\n')) {
      const line = rawLine.trim()
      if (!line.startsWith('{')) continue

      let evt: { event?: string; url?: string }
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (evt.event === 'qr_challenge' && typeof evt.url === 'string') {
        onUrl(evt.url)
      } else if (evt.event === 'qr_scanned') {
        onScanned?.()
      }
    }
  }
}

/** One NDJSON status line emitted by `aurelia login --json` while it runs. */
interface AureliaLoginEvent {
  event?: string
  /** For `guard_required`: `email` | `device` | `device_confirmation`. */
  type?: string
  message?: string
}

/**
 * Builds an `onOutput` handler
 */
export function makeAureliaLoginHandler(
  onEvent: (event: AureliaLoginEvent) => void
): (data: string) => void {
  return (data: string) => {
    for (const rawLine of stripAnsi(data).split('\n')) {
      const line = rawLine.trim()
      if (!line.startsWith('{')) continue

      let evt: AureliaLoginEvent
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof evt.event === 'string') {
        onEvent(evt)
      }
    }
  }
}

/**
 * Fetches Steam store details for one or more app ids via `aurelia info`.
 */
export async function fetchAureliaInfo(
  appIds: string[],
  options: { extended?: boolean; language?: string } = {}
): Promise<AureliaInfoResponse[]> {
  if (!appIds.length) {
    return []
  }
  const result = await runAurelia<AureliaInfoResponse | AureliaInfoResponse[]>([
    'info',
    ...appIds,
    ...(options.extended ? ['--extended'] : []),
    ...(options.language ? ['-l', options.language] : [])
  ])
  return Array.isArray(result) ? result : [result]
}

export async function getSteamLibraryPath(): Promise<string | undefined> {
  try {
    const config = await runAurelia<AureliaConfigShowResponse>([
      'config',
      'show'
    ])
    return config.steam_library_path || undefined
  } catch (error) {
    logError(
      ['Unable to read Aurelia config for Steam library path', error],
      LogPrefix.Steam
    )
    return undefined
  }
}

const STEAM_ID64_BASE = BigInt('76561197960265728')
let steamClientStartup: Promise<void> | undefined

function steamAccountId(steamId: string | number): string | undefined {
  try {
    const id = BigInt(String(steamId))
    return (id >= STEAM_ID64_BASE ? id - STEAM_ID64_BASE : id).toString()
  } catch {
    return undefined
  }
}

function steamAccountIdFromSession(): string | undefined {
  try {
    // SteamID64 is larger than JavaScript's safe integer range. Read the raw
    // JSON token instead of going through JSON.parse, which would round it.
    const session = readFileSync(join(aureliaConfigDir, 'session.json'), 'utf8')
    const match = session.match(/"steam_id"\s*:\s*"?(\d+)"?/)
    return match?.[1] ? steamAccountId(match[1]) : undefined
  } catch {
    return undefined
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isSteamClientRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const tasklist = spawn(
      'tasklist',
      ['/FI', 'IMAGENAME eq steam.exe', '/NH'],
      { windowsHide: true }
    )
    let output = ''
    tasklist.stdout?.on('data', (data: Buffer | string) => {
      output += data.toString()
    })
    tasklist.once('error', () => resolve(false))
    tasklist.once('close', (code) => {
      resolve(code === 0 && /\bsteam\.exe\b/i.test(output))
    })
  })
}

async function startSteamClient(): Promise<void> {
  if (await isSteamClientRunning()) return

  const steamLibraryPath = await getSteamLibraryPath()
  const steamExecutable = steamLibraryPath
    ? join(steamLibraryPath, 'steam.exe')
    : undefined

  if (!steamExecutable || !existsSync(steamExecutable)) {
    logWarning(
      'Steam client is not running and steam.exe could not be located',
      LogPrefix.Steam
    )
    return
  }

  logInfo('Starting the Steam client silently for this game', LogPrefix.Steam)
  const steam = spawn(steamExecutable, ['-silent'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  steam.once('error', (error) =>
    logWarning(
      ['Unable to start the Steam client', String(error)],
      LogPrefix.Steam
    )
  )
  steam.unref()

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (await isSteamClientRunning()) {
      // Steam's process appears before Steamworks is ready to answer requests.
      await delay(1500)
      return
    }
    await delay(500)
  }

  logWarning(
    'Steam client did not become ready before the game launch',
    LogPrefix.Steam
  )
}

/** Starts the Windows Steam client when a native Steam game needs Steamworks. */
export async function ensureSteamClientRunning(): Promise<void> {
  if (process.platform !== 'win32') return
  if (!steamClientStartup) {
    const startup = startSteamClient()
    steamClientStartup = startup
    void startup.finally(() => {
      if (steamClientStartup === startup) steamClientStartup = undefined
    })
  }
  await steamClientStartup
}

/**
 * Returns the Windows Steam Cloud directory used for classic (token-less)
 * files. Aurelia's default is Linux-specific, so pass the real Steam path
 * explicitly when Heroic runs on Windows.
 */
export async function getSteamCloudRemotePath(
  appId: string
): Promise<string | undefined> {
  if (process.platform !== 'win32') return undefined

  try {
    const [steamLibraryPath, account] = await Promise.all([
      getSteamLibraryPath(),
      runAurelia<AureliaAccount>(['account'])
    ])
    const accountId =
      steamAccountIdFromSession() ||
      (account && steamAccountId(account.steam_id))
    if (!steamLibraryPath || !accountId) return undefined

    return join(steamLibraryPath, 'userdata', accountId, appId, 'remote')
  } catch (error) {
    logWarning(
      ['Unable to resolve the Windows Steam Cloud path', String(error)],
      LogPrefix.Steam
    )
    return undefined
  }
}

/**
 * Lists the Steam library folders
 */
export async function getSteamInstallLibraries(): Promise<
  SteamInstallLibrary[]
> {
  try {
    const result = await runAurelia<AureliaLibrariesResponse>(['libraries'])
    return result.libraries ?? []
  } catch (error) {
    logError(['Unable to list Steam install libraries', error], LogPrefix.Steam)
    return []
  }
}
