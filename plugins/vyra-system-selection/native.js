// Native overlay layer: a real Win32 popup window painted with GDI.
//
// Why a native window instead of a Chromium one: a DSH plugin runs in the Host process, which is
// Electron in Node mode and has no BrowserWindow. Creating one would mean shipping a second
// browser. A layered Win32 popup is a few hundred microseconds to show, never steals focus, and
// needs nothing installed.
//
// The window is driven by PeekMessage on the existing Host event loop rather than a blocking
// GetMessage loop, so the Host keeps serving its own work while the popup is up.
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { bodyBlocks, clampScroll, maySynthesizeCopy, menuHitTest, menuLayout, panelSideFor, placeMenuAtSelection, placePanelAtSelection, reduceMouse } from './core.js'

function loadKoffi() {
  // The Host runs from an asar; koffi's native binary is shipped unpacked beside it. Resolve
  // through the runtime's own package rather than assuming a node_modules path.
  const bases = []
  if (process.resourcesPath) bases.push(join(process.resourcesPath, 'app.asar.unpacked', 'dsh', 'package.json'))
  bases.push(join(process.execPath, '..', 'resources', 'app.asar.unpacked', 'dsh', 'package.json'))
  let lastError
  for (const base of bases) {
    try {
      return createRequire(base)('koffi')
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`cannot load koffi: ${lastError && lastError.message}`)
}

const koffi = loadKoffi()

/** Overridable sink for native-layer warnings. The plugin points this at ctx.logger. */
let ctxWarn = (message) => console.warn(`[system-selection] ${message}`)

export function setWarnSink(fn) {
  if (typeof fn === 'function') ctxWarn = fn
}

/**
 * Pids of the DSH desktop shell: this Host's ancestors.
 *
 * The renderer is a child of the shell, so walking up from here covers every window the app owns
 * without enumerating the whole process list. Cached for a while because a reload creates new
 * renderer pids, but not so often that a mouse event pays for a snapshot.
 */
/**
 * Pids of the DSH desktop shell: this Host, the shell above it, and the shell's other children.
 *
 * The walk stops at the first ancestor that is not the DSH executable. Following the chain all the
 * way up would swallow `explorer.exe` and everything the user launched from it, and the guard that
 * uses this set would then treat the entire desktop as "inside DSH".
 *
 * Cached briefly: a reload creates new renderer pids, but a mouse event should not pay for a
 * process snapshot every time.
 */
let shellPids = new Set()
let shellPidsAt = 0
function shellProcessIds() {
  const now = Date.now()
  if (now - shellPidsAt < 5000) return shellPids
  shellPidsAt = now
  // Only this process is seeded. Seeding the parent too would stop the walk below at its first
  // step, because that loop ends when it reaches an id already in the set.
  const ids = new Set([process.pid])
  try {
    const snapshot = F.CreateToolhelp32Snapshot(2, 0)
    const size = koffi.sizeof('PROCESSENTRY32W')
    const entry = Buffer.alloc(size)
    entry.writeUInt32LE(size, 0)
    const parents = new Map()
    const images = new Map()
    if (F.Process32FirstW(snapshot, entry)) {
      do {
        const row = koffi.decode(entry, 'PROCESSENTRY32W')
        parents.set(row.th32ProcessID, row.th32ParentProcessID)
        images.set(row.th32ProcessID, String(row.szExeFile))
        entry.writeUInt32LE(size, 0)
      } while (F.Process32NextW(snapshot, entry))
    }
    F.CloseHandle(snapshot)

    // Walk up while the ancestor still runs the DSH executable.
    const own = ownImageName()
    let cur = process.pid
    for (let i = 0; i < 16; i++) {
      const parent = parents.get(cur)
      if (!parent || parent === 0 || ids.has(parent)) break
      if (images.get(parent) !== own) break // reached the desktop or a shell that launched DSH
      ids.add(parent)
      cur = parent
    }
    // Every process that shares the shell binary is part of the app: renderers, GPU, utilities.
    for (const [pid, image] of images) {
      if (image === own) ids.add(pid)
    }
  } catch (error) {
    ctxWarn(`进程树读取失败，DSH 窗口内可能多一次无用的取词：${error && error.message}`)
  }
  shellPids = ids
  return shellPids
}

/** The DSH executable's file name, lowercased, for comparing against snapshot entries. */
function ownImageName() {
  const base = process.execPath.replace(/\\/g, '/').split('/').pop() || ''
  return base.toLowerCase()
}

// --- structs ---------------------------------------------------------------------------------
// Every name registered below lives in koffi's process-wide type table, so this block
// runs once per process and its result is cached on globalThis. Re-loading the module —
// which is what installing, updating or re-enabling this plugin does inside a running
// Host — would otherwise register POINT and the rest a second time and throw
// "Duplicate type name". The library handles are cached for the same reason: the FFI
// table is built from them, and rebuilding it would drop the bound functions.
const native = globalThis[Symbol.for('vyra-system-selection.native')] ??= (() => {
  // POINT/RECT must be declared before any signature that names them.
  
  const POINT = koffi.struct('POINT', { x: 'long', y: 'long' })
  const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' })
  const KEYBDINPUT = koffi.struct('KEYBDINPUT', { wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t' })
  const MOUSEINPUT = koffi.struct('MOUSEINPUT', { dx: 'long', dy: 'long', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t' })
  const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', { uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16' })
  const INPUT = koffi.struct('INPUT', { type: 'uint32', u: koffi.union('INPUTU', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }) })
  const WNDCLASSEXW = koffi.struct('WNDCLASSEXW', {
    cbSize: 'uint32', style: 'uint32', lpfnWndProc: 'void*', cbClsExtra: 'int', cbWndExtra: 'int',
    hInstance: 'void*', hIcon: 'void*', hCursor: 'void*', hbrBackground: 'void*',
    // str16, not void*: koffi converts the JavaScript string into the buffer the struct points at,
    // and a void* field would receive the string itself and register a class with a garbage name.
    lpszMenuName: 'str16', lpszClassName: 'str16', hIconSm: 'void*',
  })
  const WNDPROC = koffi.proto('intptr_t WNDPROC(void *hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)')
  // Toolhelp process entry. Declared at module load because the FFI table below names it.
  const PROCESSENTRY32W = koffi.struct('PROCESSENTRY32W', {
    dwSize: 'uint32', cntUsage: 'uint32', th32ProcessID: 'uint32', th32DefaultHeapID: 'uintptr_t',
    th32ModuleID: 'uint32', cntThreads: 'uint32', th32ParentProcessID: 'uint32', pcPriClassBase: 'long',
    dwFlags: 'uint32', szExeFile: 'char16_t[260]',
  })
  // Low-level mouse hook payload. 32 bytes on x64: the trailing uintptr_t pads the struct.
  const MSLLHOOKSTRUCT = koffi.struct('MSLLHOOKSTRUCT', {
    pt: 'POINT', mouseData: 'uint32', flags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t',
  })
  const HOOKPROC = koffi.proto('intptr_t HOOKPROC(int code, uintptr_t wParam, void *lParam)')
  
  // --- bindings --------------------------------------------------------------------------------
  
  const u = koffi.load('user32.dll')
  const g = koffi.load('gdi32.dll')
  const k = koffi.load('kernel32.dll')
  const advapi = koffi.load('advapi32.dll')
  
  const F = {
    RegisterClassExW: u.func('uint16 __stdcall RegisterClassExW(WNDCLASSEXW *wc)'),
    CreateWindowExW: u.func('void* __stdcall CreateWindowExW(uint32 exStyle, str16 cls, str16 name, uint32 style, int x, int y, int w, int h, void* parent, void* menu, void* inst, void* param)'),
    DefWindowProcW: u.func('intptr_t __stdcall DefWindowProcW(void *h, uint32 m, uintptr_t w, intptr_t l)'),
    DestroyWindow: u.func('bool __stdcall DestroyWindow(void *h)'),
    ShowWindow: u.func('bool __stdcall ShowWindow(void *h, int cmd)'),
    SetWindowPos: u.func('bool __stdcall SetWindowPos(void *h, void *after, int x, int y, int cx, int cy, uint32 flags)'),
    SetWindowRgn: u.func('int __stdcall SetWindowRgn(void *h, void *rgn, bool redraw)'),
    InvalidateRect: u.func('bool __stdcall InvalidateRect(void *h, void *r, bool erase)'),
    GetWindowRect: u.func('bool __stdcall GetWindowRect(void *h, _Out_ RECT *r)'),
    PeekMessageW: u.func('bool __stdcall PeekMessageW(void *msg, void *h, uint32 min, uint32 max, uint32 remove)'),
    TranslateMessage: u.func('bool __stdcall TranslateMessage(void *msg)'),
    DispatchMessageW: u.func('intptr_t __stdcall DispatchMessageW(void *msg)'),
    BeginPaint: u.func('void* __stdcall BeginPaint(void *h, void *ps)'),
    EndPaint: u.func('bool __stdcall EndPaint(void *h, void *ps)'),
    FillRect: u.func('int __stdcall FillRect(void *hdc, RECT *r, void *brush)'),
    DrawTextW: u.func('int __stdcall DrawTextW(void *hdc, str16 text, int count, _Inout_ RECT *r, uint32 fmt)'),
    // The cursor name parameter is a MAKEINTRESOURCE pointer, not a string: passing "32512" asks for
    // a *named* resource, which does not exist, and LoadCursor returns null. A null cursor handed to
    // SetCursor means "draw no cursor", which is why the pointer vanished over the popup.
    LoadCursorW: u.func('void* __stdcall LoadCursorW(void *inst, void *name)'),
    SetCursor: u.func('void* __stdcall SetCursor(void *cur)'),
    GetCursorPos: u.func('bool __stdcall GetCursorPos(_Out_ POINT *p)'),
    GetAsyncKeyState: u.func('short __stdcall GetAsyncKeyState(int vk)'),
    SendInput: u.func('uint32 __stdcall SendInput(uint32 n, INPUT *inputs, int size)'),
    MapVirtualKeyW: u.func('uint32 __stdcall MapVirtualKeyW(uint32 code, uint32 type)'),
    MonitorFromPoint: u.func('void* __stdcall MonitorFromPoint(POINT pt, uint32 flags)'),
    GetMonitorInfoW: u.func('bool __stdcall GetMonitorInfoW(void *mon, _Inout_ MONITORINFO *info)'),
    GetForegroundWindow: u.func('void* __stdcall GetForegroundWindow()'),
    GetClassNameW: u.func('int __stdcall GetClassNameW(void *h, void *buf, int max)'),
    GetWindowThreadProcessId: u.func('uint32 __stdcall GetWindowThreadProcessId(void *h, _Out_ uint32 *pid)'),
    WindowFromPoint: u.func('void* __stdcall WindowFromPoint(POINT pt)'),
    GetDpiForWindow: u.func('uint32 __stdcall GetDpiForWindow(void *h)'),
    OpenClipboard: u.func('bool __stdcall OpenClipboard(void *owner)'),
    CloseClipboard: u.func('bool __stdcall CloseClipboard()'),
    EmptyClipboard: u.func('bool __stdcall EmptyClipboard()'),
    GetClipboardData: u.func('void* __stdcall GetClipboardData(uint fmt)'),
    SetClipboardData: u.func('void* __stdcall SetClipboardData(uint fmt, void *mem)'),
    IsClipboardFormatAvailable: u.func('bool __stdcall IsClipboardFormatAvailable(uint fmt)'),
    GetClipboardSequenceNumber: u.func('uint32 __stdcall GetClipboardSequenceNumber()'),
    CreateCompatibleDC: g.func('void* __stdcall CreateCompatibleDC(void *hdc)'),
    CreateCompatibleBitmap: g.func('void* __stdcall CreateCompatibleBitmap(void *hdc, int w, int h)'),
    BitBlt: g.func('bool __stdcall BitBlt(void *dst, int x, int y, int w, int h, void *src, int sx, int sy, uint32 rop)'),
    SelectObject: g.func('void* __stdcall SelectObject(void *hdc, void *obj)'),
    DeleteObject: g.func('bool __stdcall DeleteObject(void *obj)'),
    DeleteDC: g.func('bool __stdcall DeleteDC(void *hdc)'),
    CreateSolidBrush: g.func('void* __stdcall CreateSolidBrush(uint32 color)'),
    CreatePen: g.func('void* __stdcall CreatePen(int style, int width, uint32 color)'),
    RoundRect: g.func('bool __stdcall RoundRect(void *hdc, int l, int t, int r, int b, int ew, int eh)'),
    MoveToEx: g.func('bool __stdcall MoveToEx(void *hdc, int x, int y, void *prev)'),
    LineTo: g.func('bool __stdcall LineTo(void *hdc, int x, int y)'),
    SetTextColor: g.func('uint32 __stdcall SetTextColor(void *hdc, uint32 color)'),
    SetBkMode: g.func('int __stdcall SetBkMode(void *hdc, int mode)'),
    CreateFontW: g.func('void* __stdcall CreateFontW(int h, int w, int esc, int orient, int weight, uint32 italic, uint32 underline, uint32 strike, uint32 charset, uint32 prec, uint32 clip, uint32 quality, uint32 pitch, str16 face)'),
    CreateRoundRectRgn: g.func('void* __stdcall CreateRoundRectRgn(int l, int t, int r, int b, int ew, int eh)'),
    GetModuleHandleW: k.func('void* __stdcall GetModuleHandleW(str16 name)'),
    CreateToolhelp32Snapshot: k.func('void* __stdcall CreateToolhelp32Snapshot(uint32 flags, uint32 pid)'),
    Process32FirstW: k.func('bool __stdcall Process32FirstW(void *snapshot, _Inout_ PROCESSENTRY32W *entry)'),
    Process32NextW: k.func('bool __stdcall Process32NextW(void *snapshot, _Inout_ PROCESSENTRY32W *entry)'),
    CloseHandle: k.func('bool __stdcall CloseHandle(void *h)'),
    SetWindowsHookExW: u.func('void* __stdcall SetWindowsHookExW(int idHook, void *proc, void *inst, uint32 threadId)'),
    CallNextHookEx: u.func('intptr_t __stdcall CallNextHookEx(void *hook, int code, uintptr_t wParam, void *lParam)'),
    UnhookWindowsHookEx: u.func('bool __stdcall UnhookWindowsHookEx(void *hook)'),
    GetKeyState: u.func('short __stdcall GetKeyState(int vk)'),
    GlobalAlloc: k.func('void* __stdcall GlobalAlloc(uint flags, uintptr_t bytes)'),
    GlobalSize: k.func('uintptr_t __stdcall GlobalSize(void *mem)'),
    GlobalFree: k.func('void* __stdcall GlobalFree(void *mem)'),
    GlobalLock: k.func('void* __stdcall GlobalLock(void *mem)'),
    GlobalUnlock: k.func('bool __stdcall GlobalUnlock(void *mem)'),
    RegGetValueW: advapi.func('int __stdcall RegGetValueW(void *key, str16 subkey, str16 value, uint32 flags, uint32 *type, void *data, _Inout_ uint32 *size)'),
    RegCloseKey: advapi.func('int __stdcall RegCloseKey(void *key)'),
    // Themes and the high-contrast flag live in user32 as plain values; no registry read needed.
    GetSysColor: u.func('uint32 __stdcall GetSysColor(int index)'),
    SystemParametersInfoW: u.func('bool __stdcall SystemParametersInfoW(uint32 action, uint32 param, void *data, uint32 winIni)'),
  }
  return { u, g, k, advapi, F, POINT, RECT, MONITORINFO, KEYBDINPUT, MOUSEINPUT, HARDWAREINPUT, INPUT, WNDCLASSEXW, WNDPROC, PROCESSENTRY32W, MSLLHOOKSTRUCT, HOOKPROC }
})()

const { u, g, k, advapi, F, POINT, RECT, MONITORINFO, KEYBDINPUT, MOUSEINPUT, HARDWAREINPUT, INPUT, WNDCLASSEXW, WNDPROC, PROCESSENTRY32W, MSLLHOOKSTRUCT, HOOKPROC } = native
// --- constants -------------------------------------------------------------------------------

const WM_DESTROY = 0x0002
const WM_PAINT = 0x000F
const WM_CLOSE = 0x0010
const WM_ERASEBKGND = 0x0014
const WM_SETCURSOR = 0x0020
const WM_MOUSEACTIVATE = 0x0021
const WM_MOUSEMOVE = 0x0200
const WM_LBUTTONDOWN = 0x0201
const WM_LBUTTONUP = 0x0202
const WM_MOUSEWHEEL = 0x020A
const WM_RBUTTONDOWN = 0x0204
const WM_RBUTTONUP = 0x0205
const WM_MBUTTONDOWN = 0x0207
const MA_NOACTIVATE = 3

const WS_POPUP = 0x80000000
const WS_EX_TOPMOST = 0x00000008
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_NOACTIVATE = 0x08000000
const SW_HIDE = 0
const SW_SHOWNA = 8
const SWP_NOZORDER = 0x0004
const SWP_NOACTIVATE = 0x0010
const SWP_SHOWWINDOW = 0x0040

const DT_LEFT = 0x0000
const DT_CENTER = 0x0001
const DT_VCENTER = 0x0004
const DT_WORDBREAK = 0x0010
const DT_SINGLELINE = 0x0020
const DT_CALCRECT = 0x0400
const DT_END_ELLIPSIS = 0x8000
const DT_NOPREFIX = 0x0800

const TRANSPARENT = 1
const SRCCOPY = 0x00CC0020
const IDC_HAND = 32649
const IDC_ARROW = 32512

const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_SHIFT = 0x10
const VK_LWIN = 0x5B
const VK_RWIN = 0x5C
const VK_C = 0x43
const VK_INSERT = 0x2D
const VK_LBUTTON = 0x01
const INPUT_KEYBOARD = 1
const KEYEVENTF_KEYUP = 0x0002

const CF_UNICODETEXT = 13

/** Window classes that answer Ctrl+C with SIGINT instead of copy. */
const TERMINAL_CLASSES = new Set(['ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS', 'mintty'])

// Windows registry colors are 0x00BBGGRR.
const rgb = (r, g_, b) => (b << 16) | (g_ << 8) | r

/**
 * Two palettes, because a dark popup over a light application looks broken.
 *
 * The values mirror the DSH client's own light/dark tokens so the menu does not read as a foreign
 * window when it appears over the app.
 */
const THEMES = {
  dark: {
    bg: rgb(0x22, 0x26, 0x2b),
    border: rgb(0x3a, 0x41, 0x49),
    separator: rgb(0x2e, 0x33, 0x39),
    text: rgb(0xe6, 0xe9, 0xec),
    dim: rgb(0x9a, 0xa3, 0xad),
    hover: rgb(0x2f, 0x35, 0x3c),
    accent: rgb(0x4d, 0x9a, 0xff),
    danger: rgb(0xff, 0x7b, 0x72),
  },
  light: {
    bg: rgb(0xff, 0xff, 0xff),
    border: rgb(0xd8, 0xdd, 0xe3),
    separator: rgb(0xea, 0xed, 0xf1),
    text: rgb(0x1f, 0x23, 0x28),
    dim: rgb(0x6b, 0x72, 0x7c),
    hover: rgb(0xf1, 0xf3, 0xf5),
    accent: rgb(0x1a, 0x73, 0xe8),
    danger: rgb(0xd1, 0x24, 0x2f),
  },
}

/**
 * Whether the user's applications are currently light.
 *
 * `SystemUsesLightTheme` is the taskbar theme and is the wrong key: a user can run dark apps with
 * a light taskbar. `AppsUseLightTheme` is the one that governs ordinary windows.
 *
 * Re-read on every show rather than cached: switching theme is a normal thing to do while the
 * plugin is loaded, and a stale palette is immediately visible.
 */
function systemIsLight() {
  try {
    const out = Buffer.alloc(4)
    const size = Buffer.alloc(4)
    size.writeUInt32LE(4, 0)
    // HKEY_CURRENT_USER = 0x80000001. RRF_RT_REG_DWORD = 0x10.
    const status = F.RegGetValueW(
      0x80000001n, 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
      'AppsUseLightTheme', 0x00000010, null, out, size,
    )
    if (status === 0) return out.readUInt32LE(0) !== 0
  } catch {
    // Fall through to the frame colour below.
  }
  // A light window frame is the best remaining signal; COLOR_WINDOW is 5.
  return F.GetSysColor(5) > 0x00808080
}

/** Live palette. Replaced by `refreshTheme()` before each paint-bearing operation. */
let THEME = THEMES.dark
let themeIsLight = null

/**
 * Pick the palette for the current system theme.
 * @returns true when the theme changed, so the caller can repaint.
 */
export function refreshTheme() {
  const light = systemIsLight()
  if (light === themeIsLight) return false
  themeIsLight = light
  THEME = light ? THEMES.light : THEMES.dark
  return true
}

/** The resolved shell pid set. Test-only. */
export function shellProcessIdsForTest() {
  return shellProcessIds()
}

/** This process's executable file name, lowercased. Test-only. */
export function ownImageNameForTest() {
  return ownImageName()
}

/** The palette in use. Test-only. */
export function themeForTest() {
  refreshTheme()
  return { light: themeIsLight, ...THEME }
}

refreshTheme()

/** Wait after the release before copying: the target app is still settling its selection. */
const CAPTURE_DELAY_MS = 110
/** Poll cadence. Two FFI calls per tick; the cost is in waking the loop, not the calls. */
const POLL_MS = 30
/** Streaming repaints are throttled to this; text layout is the expensive part of a paint. */
const PAINT_THROTTLE_MS = 50

/** Handle of the current foreground window. Test-only: proves the overlay never takes focus. */
export function foregroundHandleForTest() {
  return F.GetForegroundWindow() ?? null
}

/**
 * Clipboard text, or null. Opens with retries because another process may hold the clipboard.
 *
 * The block is decoded to its real allocation size (`GlobalSize`) and then cut at the NUL.
 * Decoding a fixed character count instead reads past the allocation and faults the process,
 * which is a crash rather than a wrong answer.
 */
export function readClipboardText({ attempts = 12 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (F.OpenClipboard(null)) {
      try {
        if (!F.IsClipboardFormatAvailable(CF_UNICODETEXT)) return null
        const handle = F.GetClipboardData(CF_UNICODETEXT)
        if (!handle) return null
        const ptr = F.GlobalLock(handle)
        if (!ptr) return null
        try {
          const bytes = Number(F.GlobalSize(handle))
          if (!bytes) return ''
          const text = koffi.decode(ptr, 'char16_t', Math.floor(bytes / 2))
          const end = text.indexOf('\u0000')
          return end === -1 ? text : text.slice(0, end)
        } finally {
          F.GlobalUnlock(handle)
        }
      } finally {
        F.CloseClipboard()
      }
    }
    // Busy-wait rather than await: callers run this inside a synchronous capture step where
    // yielding would let another gesture interleave.
    const until = Date.now() + 20
    while (Date.now() < until) { /* spin */ }
  }
  return null
}

/**
 * Replace the clipboard text. Returns false when another process is holding the clipboard open.
 *
 * `koffi.encode`'s last argument counts ELEMENTS, not bytes: passing a byte count writes twice as
 * many UTF-16 units as were allocated and corrupts the heap.
 */
export function writeClipboardText(text) {
  for (let i = 0; i < 12; i++) {
    if (F.OpenClipboard(null)) {
      let handle = null
      try {
        F.EmptyClipboard()
        const units = text.length + 1 // the terminating NUL
        handle = F.GlobalAlloc(0x0042, units * 2) // GHND
        if (!handle) return false
        const ptr = F.GlobalLock(handle)
        if (!ptr) return false
        koffi.encode(ptr, 'char16_t', `${text}\u0000`, units)
        F.GlobalUnlock(handle)
        if (!F.SetClipboardData(CF_UNICODETEXT, handle)) return false
        handle = null // the clipboard owns the block now; freeing it would corrupt the clipboard
        return true
      } finally {
        // Only free on the paths that never handed the block to the clipboard.
        if (handle) F.GlobalFree(handle)
        F.CloseClipboard()
      }
    }
    const until = Date.now() + 20
    while (Date.now() < until) { /* spin */ }
  }
  return false
}

function foregroundClass() {
  const hwnd = F.GetForegroundWindow()
  if (!hwnd) return ''
  const buf = Buffer.alloc(512)
  const n = F.GetClassNameW(hwnd, buf, 256)
  return n > 0 ? buf.toString('ucs2', 0, n * 2) : ''
}

/**
 * Which modifier keys are physically down right now.
 *
 * `GetAsyncKeyState`'s high bit is "down as of this call", which is the question that matters: the
 * capture is about to inject a chord, and what the user's own fingers are doing decides whether
 * that chord is safe to send.
 */
export function heldModifiers() {
  const down = (vk) => (F.GetAsyncKeyState(vk) & 0x8000) !== 0
  return {
    control: down(VK_CONTROL),
    alt: down(VK_MENU),
    shift: down(VK_SHIFT),
    // Either Windows key reports through its own virtual key.
    win: down(VK_LWIN) || down(VK_RWIN),
  }
}

/**
 * Copy the current selection of the foreground window into the clipboard.
 *
 * Ctrl+C is the only way to read another application's selection without injecting into it or
 * requiring UI Automation. Terminals are sent Ctrl+Insert instead: there Ctrl+C is SIGINT, and
 * interrupting whatever the user was running would be far worse than a missed capture.
 *
 * Refuses while any modifier is held — see `maySynthesizeCopy`. The caller treats a null return as
 * "nothing selected", which is the right outcome: the menu does not open and nothing is touched.
 *
 * @returns the captured text, or null when nothing was selected or the capture was refused.
 */
export function captureSelection() {
  if (!maySynthesizeCopy(heldModifiers())) return null

  const isTerminal = TERMINAL_CLASSES.has(foregroundClass())
  const copyKey = isTerminal ? VK_INSERT : VK_C

  const before = readClipboardText()
  const sequenceBefore = F.GetClipboardSequenceNumber()

  const key = (vk, up) => ({
    type: INPUT_KEYBOARD,
    u: { ki: { wVk: vk, wScan: F.MapVirtualKeyW(vk, 0), dwFlags: up ? KEYEVENTF_KEYUP : 0, time: 0, dwExtraInfo: 0 } },
  })
  const seq = [key(VK_CONTROL, false), key(copyKey, false), key(copyKey, true), key(VK_CONTROL, true)]
  F.SendInput(seq.length, seq, koffi.sizeof(INPUT))

  // The clipboard sequence number only advances when something is actually put on the clipboard.
  // If it has not moved, the copy did not happen — there was no selection — and the clipboard's
  // current contents are the user's own, not ours to return.
  //
  // This wait blocks the Host's event loop, and the mouse hook is delivered through that same
  // loop: for as long as it spins, the system's input chain waits behind this process. That is
  // why callers must only reach here for a gesture that could have selected text — see the
  // left-release branch in `installHook`.
  // ponytail: sync spin of up to 220 ms; make the capture await instead of spin if it ever runs
  // on more than a drag or a double-click.
  let ours = 0
  const until = Date.now() + 220
  while (Date.now() < until) {
    ours = F.GetClipboardSequenceNumber()
    if (ours !== sequenceBefore) break
    const spin = Date.now() + 10
    while (Date.now() < spin) { /* spin */ }
  }
  if (ours === sequenceBefore) return null

  const captured = readClipboardText()
  // Put the previous clipboard back so a swipe over some text does not silently replace whatever
  // the user was carrying. Only the text format is restored: rich formats (HTML, RTF, images) are
  // left as the copy left them.
  //
  // The sequence number is re-checked first: reading the clipboard above takes time, and if the
  // user copied something himself in that gap, restoring would overwrite the newer copy with the
  // older text this function happened to save. Only a clipboard still holding our capture is ours
  // to put back.
  const stillOurs = F.GetClipboardSequenceNumber() === ours
  if (stillOurs && before !== null && before !== captured) writeClipboardText(before)

  if (captured === null) return null
  const core = captured.replace(/\r\n/g, '\n').replace(/\n$/, '')
  return core.length > 0 ? core : null
}

/**
 * Create the overlay. Returns null on a platform we have no bindings for, so the plugin can
 * report "unsupported" instead of throwing during startup.
/**
 * Create the overlay: one Win32 window that serves as both the right-click menu and the result
 * panel, plus the low-level mouse hook that lets the menu replace the native context menu.
 *
 * Returns null on a platform we have no bindings for, so the plugin can report "unsupported"
 * instead of throwing during startup.
 */
export function createOverlay(handlers = {}) {
  if (process.platform !== 'win32') return null

  const state = {
    hwnd: null,
    mode: 'hidden', // hidden | menu | panel
    dpi: 1,
    // menu
    actions: [],
    layout: { items: [] },
    hover: -1,
    anchor: { x: 0, y: 0 },
    // panel
    title: '',
    blocks: [],
    layoutBlocks: [],
    status: '',
    statusKind: 'info',
    scroll: 0,
    contentH: 0,
    viewH: 0,
    hoverPanel: 0,
    // painting
    memDC: null,
    memBitmap: null,
    memW: 0,
    memH: 0,
    fontUI: null,
    fontText: null,
    fontBold: null,
    fontIcon: null,
    textDirty: true,
    lastPaintAt: 0,
  }

  const HAND_CURSOR = F.LoadCursorW(null, IDC_HAND)
  const ARROW_CURSOR = F.LoadCursorW(null, IDC_ARROW)
  if (!ARROW_CURSOR) ctxWarn('标准箭头光标加载失败，弹窗上可能看不到鼠标指针')

  // --- painting ------------------------------------------------------------------------------

  function createFonts(scale) {
    for (const key of ['fontUI', 'fontText', 'fontBold', 'fontIcon']) {
      if (state[key]) F.DeleteObject(state[key])
    }
    // A negative height requests a character height rather than a cell height.
    const face = 'Microsoft YaHei UI'
    state.fontUI = F.CreateFontW(-Math.round(14 * scale), 0, 0, 0, 400, 0, 0, 0, 134, 0, 0, 5, 0, face)
    state.fontText = F.CreateFontW(-Math.round(14 * scale), 0, 0, 0, 400, 0, 0, 0, 134, 0, 0, 5, 0, face)
    state.fontBold = F.CreateFontW(-Math.round(14 * scale), 0, 0, 0, 600, 0, 0, 0, 134, 0, 0, 5, 0, face)
    // The icon face carries only the menu glyphs, so a missing font degrades to empty boxes in the
    // menu rather than breaking the labels.
    state.fontIcon = F.CreateFontW(-Math.round(15 * scale), 0, 0, 0, 400, 0, 0, 0, 1, 0, 0, 5, 0, 'Segoe Fluent Icons')
  }

  function fill(hdc, rect, color) {
    const brush = F.CreateSolidBrush(color)
    F.FillRect(hdc, rect, brush)
    F.DeleteObject(brush)
  }

  function roundRect(hdc, rect, fillColor, borderColor, radius) {
    const brush = F.CreateSolidBrush(fillColor)
    const pen = F.CreatePen(0, 1, borderColor)
    const oldBrush = F.SelectObject(hdc, brush)
    const oldPen = F.SelectObject(hdc, pen)
    F.RoundRect(hdc, rect.left, rect.top, rect.right, rect.bottom, radius * 2, radius * 2)
    F.SelectObject(hdc, oldBrush)
    F.SelectObject(hdc, oldPen)
    F.DeleteObject(brush)
    F.DeleteObject(pen)
  }

  function hline(hdc, x, y, x2, color) {
    const pen = F.CreatePen(0, 1, color)
    const old = F.SelectObject(hdc, pen)
    F.MoveToEx(hdc, x, y, null)
    F.LineTo(hdc, x2, y)
    F.SelectObject(hdc, old)
    F.DeleteObject(pen)
  }

  function measureText(hdc, text, width, font) {
    const old = F.SelectObject(hdc, font)
    const rect = { left: 0, top: 0, right: width, bottom: 0 }
    F.DrawTextW(hdc, text, -1, rect, DT_WORDBREAK | DT_CALCRECT | DT_NOPREFIX)
    F.SelectObject(hdc, old)
    return rect.bottom - rect.top
  }

  function drawMenu(hdc) {
    const { width, height, items } = state.layout
    roundRect(hdc, { left: 0, top: 0, right: width, bottom: height }, THEME.bg, THEME.border, Math.round(10 * state.dpi))
    for (let i = 0; i < state.actions.length; i++) {
      const tile = items[i]
      const action = state.actions[i]
      if (i === state.hover) {
        const inset = Math.round(2 * state.dpi)
        roundRect(hdc, { left: tile.x + inset, top: tile.y + inset, right: tile.x + tile.w - inset, bottom: tile.y + tile.h - inset },
          THEME.hover, THEME.hover, Math.round(7 * state.dpi))
      }
      // Icon and label share one row, icon first: that is the shape the user already knows from
      // every other selection toolbar, and it keeps the bar one line tall.
      F.SelectObject(hdc, state.fontIcon)
      F.SetTextColor(hdc, THEME.text)
      F.DrawTextW(hdc, String.fromCharCode(action.icon), -1,
        { left: tile.icon.left, top: tile.y, right: tile.icon.right, bottom: tile.y + tile.h },
        DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX)
      F.SelectObject(hdc, state.fontUI)
      F.SetTextColor(hdc, THEME.text)
      F.DrawTextW(hdc, action.label, -1,
        { left: tile.label.left, top: tile.y, right: tile.label.right, bottom: tile.y + tile.h },
        DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX)
    }
  }

  function panelMetrics() {
    const scale = state.dpi
    return {
      scale,
      width: Math.round(420 * scale),
      headerH: Math.round(36 * scale),
      footerH: Math.round(42 * scale),
      pad: Math.round(14 * scale),
      maxBody: Math.round(320 * scale),
      lineGap: Math.round(5 * scale),
      closeW: Math.round(26 * scale),
      copyW: Math.round(60 * scale),
    }
  }

  function panelHeight() {
    const m = panelMetrics()
    return m.headerH + state.viewH + m.footerH
  }

  /** Flatten the content blocks into draw ops with measured heights. */
  function layoutPanel(hdc) {
    const m = panelMetrics()
    const width = m.width - m.pad * 2
    const ops = []
    let y = 0
    for (const block of state.blocks) {
      if (block.kind === 'heading') {
        const h = measureText(hdc, block.text, width, state.fontBold)
        ops.push({ ...block, y, h, font: state.fontBold, color: THEME.dim })
        y += h + m.lineGap * 2
      } else if (block.kind === 'source') {
        const h = measureText(hdc, block.label, width, state.fontUI)
        ops.push({ ...block, y, h, font: state.fontUI, color: THEME.accent })
        const uh = measureText(hdc, block.url, width, state.fontText)
        ops.push({ kind: 'url', text: block.url, y: y + h, h: uh, font: state.fontText, color: THEME.dim })
        y += h + uh + m.lineGap * 2
      } else {
        const h = measureText(hdc, block.text, width, state.fontText)
        ops.push({ ...block, y, h, font: state.fontText, color: state.statusKind === 'error' ? THEME.danger : THEME.text })
        y += h + m.lineGap
      }
    }
    state.layoutBlocks = ops
    state.contentH = Math.max(Math.round(m.maxBody * 0.35), y)
    state.viewH = Math.min(state.contentH, m.maxBody)
  }

  function drawPanel(hdc) {
    const m = panelMetrics()
    const height = panelHeight()
    roundRect(hdc, { left: 0, top: 0, right: m.width, bottom: height }, THEME.bg, THEME.border, Math.round(10 * m.scale))

    F.SelectObject(hdc, state.fontBold)
    F.SetTextColor(hdc, THEME.text)
    F.DrawTextW(hdc, state.title, -1,
      { left: m.pad, top: 0, right: m.width - m.pad - m.closeW, bottom: m.headerH },
      DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX)
    F.SelectObject(hdc, state.fontIcon)
    F.SetTextColor(hdc, state.hoverPanel === -1 ? THEME.text : THEME.dim)
    F.DrawTextW(hdc, String.fromCharCode(0xE711), -1, // ChromeClose
      { left: m.width - m.pad - m.closeW, top: 0, right: m.width - m.pad, bottom: m.headerH },
      DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX)
    hline(hdc, m.pad, m.headerH, m.width - m.pad, THEME.separator)

    // Body: clipped and scrolled, so a long answer scrolls instead of growing the window.
    const bodyTop = m.headerH
    const clip = g.func('int __stdcall IntersectClipRect(void *hdc, int l, int t, int r, int b)')
    clip(hdc, m.pad, bodyTop, m.width - m.pad, bodyTop + state.viewH)
    for (const op of state.layoutBlocks) {
      const top = bodyTop + op.y - state.scroll
      if (top > bodyTop + state.viewH || top + op.h < bodyTop) continue
      F.SelectObject(hdc, op.font)
      F.SetTextColor(hdc, op.kind === 'source' && state.hoverPanel === 100 + op.index ? THEME.text : op.color)
      F.DrawTextW(hdc, op.text, -1,
        { left: m.pad, top, right: m.width - m.pad, bottom: top + op.h },
        DT_WORDBREAK | DT_NOPREFIX)
    }
    g.func('int __stdcall SelectClipRgn(void *hdc, void *rgn)')(hdc, null)

    const footTop = bodyTop + state.viewH
    F.SelectObject(hdc, state.fontUI)
    F.SetTextColor(hdc, state.statusKind === 'error' ? THEME.danger : THEME.dim)
    F.DrawTextW(hdc, state.status, -1,
      { left: m.pad, top: footTop, right: m.width - m.pad - m.copyW - 8, bottom: footTop + m.footerH },
      DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX)
    const copyH = Math.round(26 * m.scale)
    const copyTop = footTop + Math.round((m.footerH - copyH) / 2)
    const copyRect = { left: m.width - m.pad - m.copyW, top: copyTop, right: m.width - m.pad, bottom: copyTop + copyH }
    roundRect(hdc, copyRect, state.hoverPanel === 1 ? THEME.hover : THEME.bg, THEME.border, Math.round(6 * m.scale))
    F.SetTextColor(hdc, state.hoverPanel === 1 ? THEME.text : THEME.dim)
    F.DrawTextW(hdc, '复制', -1, copyRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX)
  }

  function paint(hwnd) {
    const ps = Buffer.alloc(128)
    const hdc = F.BeginPaint(hwnd, ps)
    if (!hdc) return
    const m = panelMetrics()
    const w = state.mode === 'panel' ? m.width : state.layout.width
    const h = state.mode === 'panel' ? panelHeight() : state.layout.height

    // Double buffer: GDI draws straight to the screen otherwise, and a hover repaint without this
    // flickers the whole popup.
    if (!state.memDC || state.memW !== w || state.memH !== h) {
      if (state.memBitmap) F.DeleteObject(state.memBitmap)
      if (state.memDC) F.DeleteDC(state.memDC)
      state.memDC = F.CreateCompatibleDC(hdc)
      state.memBitmap = F.CreateCompatibleBitmap(hdc, w, h)
      state.memW = w
      state.memH = h
    }
    const oldBitmap = F.SelectObject(state.memDC, state.memBitmap)
    F.SetBkMode(state.memDC, TRANSPARENT)
    if (state.mode === 'panel') drawPanel(state.memDC)
    else drawMenu(state.memDC)
    F.BitBlt(hdc, 0, 0, w, h, state.memDC, 0, 0, SRCCOPY)
    F.SelectObject(state.memDC, oldBitmap)
    F.EndPaint(hwnd, ps)
    state.lastPaintAt = Date.now()
  }

  // --- geometry ------------------------------------------------------------------------------

  function workAreaAt(x, y) {
    const mon = F.MonitorFromPoint({ x, y }, 2) // MONITOR_DEFAULTTONEAREST
    const info = { cbSize: koffi.sizeof(MONITORINFO) }
    if (!F.GetMonitorInfoW(mon, info)) return { left: 0, top: 0, right: 1920, bottom: 1080 }
    return { left: info.rcWork.left, top: info.rcWork.top, right: info.rcWork.right, bottom: info.rcWork.bottom }
  }

  function containsPoint(pt) {
    if (!state.hwnd || state.mode === 'hidden') return false
    const r = {}
    if (!F.GetWindowRect(state.hwnd, r)) return false
    return pt.x >= r.left && pt.x < r.right && pt.y >= r.top && pt.y < r.bottom
  }

  /**
   * True when `pt` falls on one of the DSH desktop's own windows.
   *
   * The renderer is a separate process from this Host, so the check walks the shell's process
   * tree rather than comparing to `process.pid`. Used to keep the clipboard-priming off the
   * in-app surface, where a copy does nothing but costs a busy-wait on every click.
   */
  function windowUnderPoint(pt) {
    const hwnd = F.WindowFromPoint({ x: pt.x, y: pt.y })
    if (!hwnd) return false
    if (hwnd === state.hwnd) return false // our own popup; containsPoint owns that case
    const pid = Buffer.alloc(4)
    F.GetWindowThreadProcessId(hwnd, pid)
    return shellProcessIds().has(pid.readUInt32LE(0))
  }

  /** Which part of the panel a client-area point falls on, for hover and click routing. */
  function panelZone(x, y) {
    const m = panelMetrics()
    const footTop = m.headerH + state.viewH
    if (y >= footTop && x >= m.width - m.pad - m.copyW) return 1
    if (y < m.headerH && x >= m.width - m.pad - m.closeW) return -1
    // A source line behaves as a link: report its index so the click opens the right URL.
    const rel = y - m.headerH + state.scroll
    for (const op of state.layoutBlocks) {
      if (op.kind === 'source' && rel >= op.y - 2 && rel < op.y + op.h + Math.round(16 * state.dpi)) return 100 + op.index
    }
    return 0
  }

  function ensureWindow() {
    if (state.hwnd) return state.hwnd
    const hInst = F.GetModuleHandleW(null)
    const className = 'DshSystemSelectionOverlay'

    const proc = koffi.register((hwnd, msg, wParam, lParam) => {
      const x = lParam & 0xffff
      const y = (lParam >> 16) & 0xffff
      switch (msg) {
        case WM_MOUSEACTIVATE:
          return MA_NOACTIVATE // never take focus away from the app being read
        case WM_ERASEBKGND:
          return 1 // fully repainted in WM_PAINT
        case WM_SETCURSOR: {
          // Always set a cursor inside the popup. Returning without setting one lets the window
          // inherit whatever the window underneath last used, which can leave no cursor at all
          // over a layered window.
          const over = state.mode === 'menu' ? state.hover >= 0 : state.hoverPanel > 0
          F.SetCursor(over ? HAND_CURSOR : ARROW_CURSOR)
          return 1
        }
        case WM_PAINT:
          paint(hwnd)
          return 0
        case WM_MOUSEMOVE: {
          if (state.mode === 'menu') {
            const idx = menuHitTest(state.layout, x, y)
            if (idx !== state.hover) {
              state.hover = idx
              F.InvalidateRect(hwnd, null, false)
            }
          } else {
            const zone = panelZone(x, y)
            if (zone !== state.hoverPanel) {
              state.hoverPanel = zone
              F.SetCursor(zone >= 100 ? HAND_CURSOR : ARROW_CURSOR)
              F.InvalidateRect(hwnd, null, false)
            }
          }
          return 0
        }
        case WM_LBUTTONDOWN: {
          if (state.mode === 'menu') {
            const idx = menuHitTest(state.layout, x, y)
            if (idx >= 0 && handlers.onAction) handlers.onAction(state.actions[idx].id, state.anchor)
          } else {
            const zone = panelZone(x, y)
            if (zone === 1) { if (handlers.onPanelCopy) handlers.onPanelCopy() }
            else if (zone === -1) { if (handlers.onPanelClose) handlers.onPanelClose() }
            else if (zone >= 100) {
              const op = state.layoutBlocks.find((b) => b.kind === 'source' && b.index === zone - 100)
              if (op && handlers.onOpenUrl) handlers.onOpenUrl(op.url)
            }
          }
          return 0
        }
        case WM_MOUSEWHEEL: {
          const raw = (wParam >> 16) & 0xffff
          const delta = raw >= 0x8000 ? raw - 0x10000 : raw
          if (state.mode === 'panel') {
            const next = clampScroll(state.scroll - Math.round(delta / 120) * Math.round(52 * state.dpi), state.contentH, state.viewH)
            if (next !== state.scroll) {
              state.scroll = next
              F.InvalidateRect(hwnd, null, false)
            }
          }
          return 0
        }
        case WM_RBUTTONDOWN:
          if (handlers.onDismiss) handlers.onDismiss()
          return 0
        case WM_CLOSE:
          if (handlers.onDismiss) handlers.onDismiss()
          return 0
        default:
          return F.DefWindowProcW(hwnd, msg, wParam, lParam)
      }
    }, koffi.pointer(WNDPROC))

    F.RegisterClassExW({
      cbSize: koffi.sizeof(WNDCLASSEXW), style: 0, lpfnWndProc: proc, cbClsExtra: 0, cbWndExtra: 0,
      hInstance: hInst, hIcon: null, hCursor: ARROW_CURSOR, hbrBackground: null,
      lpszMenuName: null, lpszClassName: className, hIconSm: null,
    })

    state.hwnd = F.CreateWindowExW(
      WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
      className, 'DSH', WS_POPUP,
      0, 0, 10, 10, null, null, hInst, null,
    )
    if (!state.hwnd) throw new Error('CreateWindowExW failed')
    state.dpi = (F.GetDpiForWindow(state.hwnd) || 96) / 96
    createFonts(state.dpi)
    return state.hwnd
  }

  function showAt(width, height, x, y) {
    const hwnd = ensureWindow()
    refreshTheme() // the user may have switched theme since the last show
    const radius = Math.round(9 * state.dpi)
    F.SetWindowRgn(hwnd, F.CreateRoundRectRgn(0, 0, width + 1, height + 1, radius * 2, radius * 2), true)
    F.SetWindowPos(hwnd, null, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW)
    startPump()
  }

  /** Drain the thread's message queue once. Used before stopping the pump for good. */
  function pumpOnce() {
    const msg = Buffer.alloc(128)
    while (F.PeekMessageW(msg, null, 0, 0, 1)) {
      F.TranslateMessage(msg)
      F.DispatchMessageW(msg)
    }
  }

  function pump() {
    pumpOnce()
    // Pick up a theme switch while the popup is open. A registry read per frame would be wasteful,
    // so it is checked about once a second; every show re-checks anyway.
    if (state.mode !== 'hidden' && Date.now() - lastThemeCheck >= 1000) {
      lastThemeCheck = Date.now()
      if (refreshTheme() && state.hwnd) F.InvalidateRect(state.hwnd, null, false)
    }
    if (state.hwnd && state.mode === 'panel' && state.textDirty && Date.now() - state.lastPaintAt >= PAINT_THROTTLE_MS) {
      state.textDirty = false
      const hdc = F.CreateCompatibleDC(null)
      layoutPanel(hdc)
      F.DeleteDC(hdc)
      const m = panelMetrics()
      const height = panelHeight()
      // Re-place against the selection, holding the side chosen when the panel opened, so growth
      // extends away from the selection instead of sliding the panel across it.
      const rect = state.selectionRect ?? {
        left: state.anchor.x, top: state.anchor.y, right: state.anchor.x, bottom: state.anchor.y,
      }
      const work = workAreaAt(rect.left, rect.top)
      const pos = placePanelAtSelection(rect, { width: m.width, height }, work, state.panelSide)
      F.SetWindowPos(state.hwnd, null, pos.x, pos.y, m.width, height, SWP_NOZORDER | SWP_NOACTIVATE)
      F.InvalidateRect(state.hwnd, null, false)
    }
  }
  let lastThemeCheck = 0

  let timer = null
  function startPump() {
    if (timer) return
    timer = setInterval(pump, 16)
    if (timer.unref) timer.unref()
  }
  function stopPump() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  // --- low-level mouse hook -------------------------------------------------------------------

  // A right-click over a selection must open OUR menu, not the application's. There is no way to
  // ask an arbitrary application to stand down, so the click is swallowed before delivery and
  // replaced by our own popup.
  //
  // The callback MUST return in well under Windows' LowLevelHooksTimeout (300 ms by default) or
  // the system silently removes the hook. Reading the selection takes ~100-300 ms — Ctrl+C plus a
  // clipboard wait — so the handler here answers synchronously from cached state and the actual
  // read happens later, off this callback. That is why `onRightClick` is split into a synchronous
  // decision and an asynchronous follow-up.
  let hook = null
  let hookProc = null
  let suppressedAt = 0
  let lastSelection = { text: '', at: 0 }
  let primeTimer = null

  /**
   * Refresh the cached selection. Runs off the hook callback, never inside it: the read costs
   * 100-300 ms and the hook must answer within Windows' LowLevelHooksTimeout.
   */
  function refreshSelection() {
    try {
      const text = captureSelection()
      lastSelection = { text: text || '', at: Date.now() }
    } catch {
      lastSelection = { text: '', at: Date.now() }
    }
    return lastSelection.text
  }

  /**
   * A selection only exists between a drag ending and the next click. The left-button release is
   * therefore the moment to read it, so the right-click that follows can decide instantly from
   * cache instead of reading the clipboard inside the hook.
   *
   * The read is deferred one tick so the releasing application has committed its selection.
   */
  function primeSelection() {
    if (primeTimer) clearTimeout(primeTimer)
    primeTimer = setTimeout(() => {
      primeTimer = null
      refreshSelection()
    }, CAPTURE_DELAY_MS)
    if (primeTimer.unref) primeTimer.unref()
  }

  function installHook() {
    if (hook) return true
    // Drag / multi-click bookkeeping for the left button. A click that neither travelled nor
    // repeated cannot have selected anything, and priming it anyway costs a 220 ms clipboard
    // wait — see `primeSelection`. The state machine is the same one the poll uses.
    let pressState = null
    hookProc = koffi.register((code, wParam, lParam) => {
      if (code < 0) return F.CallNextHookEx(null, code, wParam, lParam)

      // Mouse moves and wheel events are the overwhelming majority of what this hook sees, and
      // they decide nothing. A low-level hook callback serializes the system's input pipeline, so
      // anything spent here is felt as cursor stutter at 500–1000 Hz: leave through the cheapest
      // possible path before touching lParam.
      if (wParam !== WM_LBUTTONDOWN && wParam !== WM_LBUTTONUP
        && wParam !== WM_RBUTTONDOWN && wParam !== WM_RBUTTONUP && wParam !== WM_MBUTTONDOWN) {
        return F.CallNextHookEx(null, code, wParam, lParam)
      }

      const info = koffi.decode(lParam, 'MSLLHOOKSTRUCT')
      const pt = { x: info.pt.x, y: info.pt.y }
      const now = Date.now()

      // A click anywhere outside the popup dismisses it, the way every other menu behaves. The
      // click itself is NOT swallowed: the user aimed it at the application behind, and eating it
      // would make the first click after a menu feel broken.
      if (wParam === WM_LBUTTONDOWN || wParam === WM_RBUTTONDOWN || wParam === WM_MBUTTONDOWN) {
        if (!containsPoint(pt)) {
          if (state.mode !== 'hidden' && handlers.onDismiss) {
            try {
              handlers.onDismiss()
            } catch {
              // A failing dismiss handler must not swallow the click.
            }
          }
        } else if (wParam === WM_RBUTTONDOWN && state.mode !== 'hidden') {
          // A right-click on our own popup: close it rather than letting the hook fall through to
          // the right-click branch, which would open a second menu on top of this one.
          if (handlers.onDismiss) handlers.onDismiss()
          suppressedAt = now
          return 1
        }
      }

      if (wParam === WM_LBUTTONDOWN) {
        pressState = reduceMouse(pressState, { down: true, x: pt.x, y: pt.y, t: now }).state
        return F.CallNextHookEx(null, code, wParam, lParam)
      }

      // Observe left releases to keep the cached selection warm; these are never swallowed.
      //
      // Only a gesture that could have selected something primes: a plain click places a caret,
      // and priming it injected Ctrl+C and spun for the full 220 ms timeout on every ordinary
      // click in every application — which blocks the message pump and is what made the whole
      // desktop feel sticky.
      //
      // Skipped over the DSH window: that surface is read by the page's own `getSelection()`, not
      // by Ctrl+C, and priming there would fire a copy into a Chromium renderer that ignores it.
      if (wParam === WM_LBUTTONUP) {
        const { state: next, fire } = reduceMouse(pressState, { down: false, x: pt.x, y: pt.y, t: now })
        pressState = next
        if (fire && !windowUnderPoint(pt)) primeSelection()
        return F.CallNextHookEx(null, code, wParam, lParam)
      }
      // Never swallow a click aimed at our own popup, or the menu could not be dismissed.
      const own = containsPoint(pt)
      if (wParam === WM_RBUTTONDOWN && !own && handlers.onRightClick) {
        let swallow = false
        try {
          // A pure decision over cached state: no clipboard, no I/O, no waiting.
          swallow = handlers.onRightClick(pt, cachedSelection()) === true
        } catch {
          swallow = false // a failing handler must not eat the user's right-click
        }
        if (swallow) {
          suppressedAt = now
          return 1
        }
      }
      // Swallow the matching release too: an up-event without its down-event makes some
      // applications open their menu anyway.
      if (wParam === WM_RBUTTONUP && now - suppressedAt < 400) {
        suppressedAt = 0
        return 1
      }
      return F.CallNextHookEx(null, code, wParam, lParam)
    }, koffi.pointer(HOOKPROC))

    hook = F.SetWindowsHookExW(14 /* WH_MOUSE_LL */, hookProc, null, 0)
    if (!hook) {
      ctxWarn('右键拦截不可用（SetWindowsHookEx 失败），原生右键菜单将照常弹出')
      hookProc = null
      return false
    }
    // A WH_MOUSE_LL callback is delivered through this thread's message queue, so the pump has to
    // be running before the first click — not merely once a window is shown, which is later.
    startPump()
    return true
  }

  function removeHook() {
    if (!hook) return true
    const removed = F.UnhookWindowsHookEx(hook) === true
    hook = null
    // The callback registration is deliberately NOT dropped here: the system may still be inside a
    // call to it when Unhook returns, and clearing the reference then would pull the function out
    // from under the hook chain. koffi releases it at process exit; one stale registration is
    // harmless, a dangling one is a crash.
    if (primeTimer) clearTimeout(primeTimer)
    primeTimer = null
    return removed
  }

  /**
   * Drive the message queue until the unhook has taken effect.
   *
   * `UnhookWindowsHookEx` returning true only means the request was accepted: the hook stays in
   * the chain until this thread processes the removal. Measured behaviour is that the very next
   * click can still be swallowed, so the queue is pumped across a short real-time window rather
   * than a fixed number of drains.
   */
  function unhookSettled() {
    const until = Date.now() + 120
    while (Date.now() < until) {
      pumpOnce()
      const spin = Date.now() + 8
      while (Date.now() < spin) { /* yield the CPU so the shell can process the removal */ }
    }
    pumpOnce()
  }

  /** The selection read at the last left-button release, if it is still recent enough to trust. */
  function cachedSelection() {
    return Date.now() - lastSelection.at < 4000 ? lastSelection.text : ''
  }

  /**
   * The selection primed by the release that just happened, or ''.
   *
   * The window is deliberately far tighter than {@link cachedSelection}'s: this answer decides
   * whether the auto-open path needs its own capture, and a stale entry would make it open the menu
   * on text from an earlier gesture. `CAPTURE_DELAY_MS` plus the poll's own cadence lands well
   * inside it, so a release that primed always qualifies and an older one never does.
   */
  function freshSelection() {
    return Date.now() - lastSelection.at < 400 ? lastSelection.text : ''
  }

  // --- public surface -------------------------------------------------------------------------

  return {
    get available() {
      return true
    },
    get hookActive() {
      return hook !== null
    },
    get visible() {
      return state.mode !== 'hidden'
    },
    get mode() {
      return state.mode
    },
    installHook,
    /**
     * Read the current selection now. Used by the drag trigger and by the settings page; never
     * call it from inside the mouse hook.
     */
    readSelection: refreshSelection,
    /** The selection captured at the last left-button release, or ''. */
    cachedSelection,
    /** The selection primed by the release that just happened, or ''. Never captures. */
    freshSelection,
    /** Screen rect of the popup, or null. Used to ignore clicks on our own surface. */
    rect() {
      if (!state.hwnd || state.mode === 'hidden') return null
      const r = {}
      if (!F.GetWindowRect(state.hwnd, r)) return null
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    },
    showMenu({ anchor, actions }) {
      // Item widths come from the labels, so the bar must be measured before it is shown: a
      // guessed width would either clip a label or leave a gap that looks like a broken button.
      state.mode = 'menu'
      state.actions = actions
      state.hover = -1
      state.anchor = { x: Math.round((anchor.left + anchor.right) / 2), y: anchor.bottom }
      state.textDirty = false
      ensureWindow()
      const hdc = F.CreateCompatibleDC(null)
      const measure = (label) => {
        F.SelectObject(hdc, state.fontUI)
        const box = { left: 0, top: 0, right: 0, bottom: 0 }
        F.DrawTextW(hdc, label, -1, box, DT_SINGLELINE | DT_CALCRECT | DT_NOPREFIX)
        return box.right - box.left
      }
      const layout = menuLayout(actions, state.dpi, measure)
      F.DeleteDC(hdc)
      state.layout = layout
      const pos = placeMenuAtSelection(anchor, layout, workAreaAt(anchor.left, anchor.top))
      showAt(layout.width, layout.height, pos.x, pos.y)
    },
    showPanel({ anchor, title, status }) {
      state.mode = 'panel'
      state.title = title
      state.blocks = []
      state.layoutBlocks = []
      state.status = status || '正在生成…'
      state.statusKind = 'info'
      state.scroll = 0
      state.hoverPanel = 0
      // The rect the panel is anchored to, kept so every later resize re-places against the same
      // selection rather than against wherever the panel happens to be.
      state.selectionRect = anchor
      state.anchor = { x: Math.round((anchor.left + anchor.right) / 2), y: anchor.top }
      state.textDirty = true
      ensureWindow()
      const m = panelMetrics()
      const hdc = F.CreateCompatibleDC(null)
      layoutPanel(hdc)
      F.DeleteDC(hdc)
      const work = workAreaAt(anchor.left, anchor.top)
      // Chosen once, from the first size, and held for the panel's life. A streaming answer grows
      // the window many times; re-deciding each time would make it jump across the selection.
      state.panelSide = panelSideFor(anchor, { width: m.width, height: panelHeight() }, work)
      const pos = placePanelAtSelection(anchor, { width: m.width, height: panelHeight() }, work, state.panelSide)
      showAt(m.width, panelHeight(), pos.x, pos.y)
    },
    setContent(answer, sources) {
      if (state.mode !== 'panel') return
      state.blocks = bodyBlocks(answer, sources || [])
      state.textDirty = true
      // Follow the tail while the model streams, so the newest line stays visible.
      state.scroll = Number.MAX_SAFE_INTEGER
    },
    setStatus(text, kind = 'info') {
      if (state.mode !== 'panel') return
      state.status = text
      state.statusKind = kind
      // A finished answer should start at the top rather than wherever streaming left the scroll.
      if (kind !== 'info') state.scroll = 0
      state.textDirty = true
      if (state.hwnd) F.InvalidateRect(state.hwnd, null, false)
    },
    hide() {
      if (state.mode === 'hidden') return
      state.mode = 'hidden'
      state.hover = -1
      state.hoverPanel = 0
      if (state.hwnd) F.ShowWindow(state.hwnd, SW_HIDE)
      // The pump keeps running while the hook is installed: it is how the hook's callbacks reach
      // this thread, so stopping it here would silently disable right-click detection.
      if (!hook) stopPump()
    },
    destroy() {
      // Order matters: unhooking is delivered through the message queue, so the pump has to still
      // be running when the hook is removed. Stopping it first leaves the hook installed, and every
      // later right-click on the machine keeps being swallowed by a destroyed overlay.
      removeHook()
      // Unhooking is asynchronous: the request is posted and the system's hook chain is only
      // updated once it is processed, which is what the pump below drives. A fixed number of
      // drains is a guess and was measurably not enough; drive the queue until the unhook has
      // demonstrably taken effect instead.
      unhookSettled()
      stopPump()
      if (state.memBitmap) F.DeleteObject(state.memBitmap)
      if (state.memDC) F.DeleteDC(state.memDC)
      for (const key of ['fontUI', 'fontText', 'fontBold', 'fontIcon']) {
        if (state[key]) F.DeleteObject(state[key])
        state[key] = null
      }
      state.memBitmap = state.memDC = null
      if (state.hwnd) {
        F.DestroyWindow(state.hwnd)
        state.hwnd = null
      }
    },
    /** True when the pointer is over our popup, so a gesture starting there is not a selection. */
    containsPoint,
    /** True when `pt` is over one of the DSH desktop's own windows. */
    windowUnderPoint,
    cursor() {
      const pt = {}
      F.GetCursorPos(pt)
      return pt
    },
    leftButtonDown() {
      return (F.GetAsyncKeyState(VK_LBUTTON) & 0x8000) !== 0
    },
    /** True while Ctrl or Alt is held, so the drag trigger can require an explicit modifier. */
    modifierHeld() {
      return (F.GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0 || (F.GetAsyncKeyState(VK_MENU) & 0x8000) !== 0
    },
  }
}

export { CAPTURE_DELAY_MS, POLL_MS }
