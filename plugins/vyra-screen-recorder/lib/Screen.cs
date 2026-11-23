// 屏幕采集辅助类（C# 5 语法，供 PowerShell Add-Type 编译）。
//
// 为什么在宿主侧抓屏：DSH 桌面版（Electron）把 display-capture 权限写死拒绝，
// 浏览器里的 getDisplayMedia / chromeMediaSource 都拿不到流。这里用 GDI 抓
// 虚拟桌面像素，和浏览器无关；截图、录屏共用同一套坐标。
//
// 坐标约定：全部是物理像素，原点为虚拟桌面左上角（多显示器时可能是负数）。
// 进程启动时切到 Per-Monitor V2 DPI 感知，避免 150% 缩放下坐标和像素对不上。
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public sealed class ScreenRect
{
    public int x;
    public int y;
    public int w;
    public int h;

    public ScreenRect(int x, int y, int w, int h)
    {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
}

public sealed class MonitorInfo
{
    public int index;
    public string name;
    public int x;
    public int y;
    public int w;
    public int h;
    public bool primary;
}

public sealed class WindowInfo
{
    public long hwnd;
    public string title;
    public string process;
    public int x;
    public int y;
    public int w;
    public int h;
}

public static class ScreenCapture
{
    private const int SM_XVIRTUALSCREEN = 76;
    private const int SM_YVIRTUALSCREEN = 77;
    private const int SM_CXVIRTUALSCREEN = 78;
    private const int SM_CYVIRTUALSCREEN = 79;
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const int MONITORINFOF_PRIMARY = 1;
    private const int DI_NORMAL = 3;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public int dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct CURSORINFO
    {
        public int cbSize;
        public int flags;
        public IntPtr hCursor;
        public POINT ptScreenPos;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ICONINFO
    {
        public int fIcon;
        public uint xHotspot;
        public uint yHotspot;
        public IntPtr hbmMask;
        public IntPtr hbmColor;
    }

    private delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, IntPtr lprcMonitor, IntPtr dwData);
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")]
    private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
    [DllImport("user32.dll")]
    private static extern bool GetCursorInfo(ref CURSORINFO pci);
    [DllImport("user32.dll")]
    private static extern bool GetIconInfo(IntPtr hIcon, out ICONINFO piconinfo);
    [DllImport("user32.dll")]
    private static extern bool DrawIconEx(IntPtr hdc, int xLeft, int yTop, IntPtr hIcon, int cxWidth, int cyWidth, int istepIfAniCur, IntPtr hbrFlickerFreeDraw, int diFlags);
    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    private static readonly ImageCodecInfo JpegCodec;
    private static readonly List<MonitorInfo> Monitors = new List<MonitorInfo>();
    private static readonly List<WindowInfo> Windows = new List<WindowInfo>();

    static ScreenCapture()
    {
        try
        {
            if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDPIAware();
        }
        catch
        {
            try { SetProcessDPIAware(); } catch { }
        }

        ImageCodecInfo[] codecs = ImageCodecInfo.GetImageEncoders();
        for (int i = 0; i < codecs.Length; i++)
        {
            if (codecs[i].MimeType == "image/jpeg") { JpegCodec = codecs[i]; break; }
        }
    }

    /** 虚拟桌面矩形（所有显示器并集）。 */
    public static ScreenRect VirtualScreen()
    {
        return new ScreenRect(
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
            GetSystemMetrics(SM_CXVIRTUALSCREEN),
            GetSystemMetrics(SM_CYVIRTUALSCREEN));
    }

    /** 各显示器矩形。 */
    public static MonitorInfo[] GetMonitors()
    {
        Monitors.Clear();
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, new MonitorEnumProc(MonitorCallback), IntPtr.Zero);
        return Monitors.ToArray();
    }

    private static bool MonitorCallback(IntPtr hMonitor, IntPtr hdc, IntPtr lprcMonitor, IntPtr dwData)
    {
        MONITORINFOEX info = new MONITORINFOEX();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
        if (GetMonitorInfo(hMonitor, ref info))
        {
            MonitorInfo item = new MonitorInfo();
            item.index = Monitors.Count + 1;
            item.name = info.szDevice == null ? string.Empty : info.szDevice.Trim();
            item.x = info.rcMonitor.Left;
            item.y = info.rcMonitor.Top;
            item.w = info.rcMonitor.Right - info.rcMonitor.Left;
            item.h = info.rcMonitor.Bottom - info.rcMonitor.Top;
            item.primary = (info.dwFlags & MONITORINFOF_PRIMARY) != 0;
            Monitors.Add(item);
        }
        return true;
    }

    /** 可见顶层窗口（有标题、非工具窗口、非最小化）。 */
    public static WindowInfo[] GetVisibleWindows()
    {
        Windows.Clear();
        EnumWindows(new EnumWindowsProc(WindowCallback), IntPtr.Zero);
        return Windows.ToArray();
    }

    private static bool WindowCallback(IntPtr hWnd, IntPtr lParam)
    {
        if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;
        int titleLength = GetWindowTextLength(hWnd);
        if (titleLength <= 0) return true;

        StringBuilder title = new StringBuilder(titleLength + 1);
        GetWindowText(hWnd, title, title.Capacity);
        string text = title.ToString().Trim();
        if (text.Length == 0) return true;

        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
        if ((exStyle & WS_EX_TOOLWINDOW) != 0) return true;

        StringBuilder cls = new StringBuilder(256);
        GetClassName(hWnd, cls, cls.Capacity);
        string className = cls.ToString();
        if (className == "Progman" || className == "WorkerW" || className == "Shell_TrayWnd"
            || className.StartsWith("Windows.UI.Core")) return true;

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        if (pid == (uint)Process.GetCurrentProcess().Id) return true;

        RECT rect = WindowBoundsRect(hWnd);
        int w = rect.Right - rect.Left;
        int h = rect.Bottom - rect.Top;
        if (w < 160 || h < 100) return true;

        string processName = string.Empty;
        try { processName = Process.GetProcessById((int)pid).ProcessName; }
        catch { }

        WindowInfo info = new WindowInfo();
        info.hwnd = hWnd.ToInt64();
        info.title = text;
        info.process = processName;
        info.x = rect.Left;
        info.y = rect.Top;
        info.w = w;
        info.h = h;
        Windows.Add(info);
        return true;
    }

    private static RECT WindowBoundsRect(IntPtr hWnd)
    {
        RECT rect;
        // DWM 扩展边框才是用户看到的窗口矩形（GetWindowRect 含不可见阴影）。
        if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT))) != 0)
        {
            GetWindowRect(hWnd, out rect);
        }
        return rect;
    }

    /** 窗口当前矩形；窗口失效/最小化时返回 null。 */
    public static ScreenRect WindowBounds(long hwnd)
    {
        IntPtr handle = new IntPtr(hwnd);
        if (handle == IntPtr.Zero || !IsWindow(handle) || IsIconic(handle)) return null;
        RECT rect = WindowBoundsRect(handle);
        int w = rect.Right - rect.Left;
        int h = rect.Bottom - rect.Top;
        if (w <= 0 || h <= 0) return null;
        return new ScreenRect(rect.Left, rect.Top, w, h);
    }

    /**
     * 抓一块屏幕并保存为 JPEG。
     * @param x/y/w/h 源矩形（虚拟桌面物理像素）。
     * @param outW/outH 输出尺寸；0 表示不缩放。
     * @param drawCursor 是否把鼠标指针画进画面。
     * @returns 输出文件路径。
     */
    public static string CaptureToJpeg(int x, int y, int w, int h, int outW, int outH, int quality, string file, bool drawCursor)
    {
        if (w <= 0 || h <= 0) throw new ArgumentException("empty capture region");
        if (quality < 1 || quality > 100) quality = 70;

        ScreenRect virtualRect = VirtualScreen();
        int sx = Math.Max(x, virtualRect.x);
        int sy = Math.Max(y, virtualRect.y);
        int ex = Math.Min(x + w, virtualRect.x + virtualRect.w);
        int ey = Math.Min(y + h, virtualRect.y + virtualRect.h);
        int cw = ex - sx;
        int ch = ey - sy;

        using (Bitmap bitmap = new Bitmap(w, h, PixelFormat.Format24bppRgb))
        {
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Black);
                if (cw > 0 && ch > 0)
                {
                    graphics.CopyFromScreen(sx, sy, sx - x, sy - y, new Size(cw, ch), CopyPixelOperation.SourceCopy);
                }
                if (drawCursor) DrawCursor(graphics, x, y);
            }

            if (outW > 0 && outH > 0 && (outW != w || outH != h))
            {
                using (Bitmap scaled = new Bitmap(outW, outH, PixelFormat.Format24bppRgb))
                {
                    using (Graphics graphics = Graphics.FromImage(scaled))
                    {
                        graphics.InterpolationMode = InterpolationMode.HighQualityBilinear;
                        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        graphics.DrawImage(bitmap, 0, 0, outW, outH);
                    }
                    SaveJpeg(scaled, file, quality);
                }
            }
            else
            {
                SaveJpeg(bitmap, file, quality);
            }
        }
        return file;
    }

    private static void DrawCursor(Graphics graphics, int captureX, int captureY)
    {
        CURSORINFO cursor = new CURSORINFO();
        cursor.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
        if (!GetCursorInfo(ref cursor) || (cursor.flags & 1) == 0) return;

        ICONINFO icon = new ICONINFO();
        if (!GetIconInfo(cursor.hCursor, out icon)) return;
        try
        {
            int px = cursor.ptScreenPos.X - (int)icon.xHotspot - captureX;
            int py = cursor.ptScreenPos.Y - (int)icon.yHotspot - captureY;
            IntPtr hdc = graphics.GetHdc();
            try
            {
                DrawIconEx(hdc, px, py, cursor.hCursor, 0, 0, 0, IntPtr.Zero, DI_NORMAL);
            }
            finally
            {
                graphics.ReleaseHdc(hdc);
            }
        }
        finally
        {
            if (icon.hbmMask != IntPtr.Zero) DeleteObject(icon.hbmMask);
            if (icon.hbmColor != IntPtr.Zero) DeleteObject(icon.hbmColor);
        }
    }

    private static void SaveJpeg(Bitmap bitmap, string file, int quality)
    {
        if (JpegCodec == null) throw new InvalidOperationException("JPEG encoder unavailable");
        EncoderParameters parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
        bitmap.Save(file, JpegCodec, parameters);
    }
}
