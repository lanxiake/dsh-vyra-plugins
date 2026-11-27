// wgcrec — capture a frame sequence of ONE window via Windows.Graphics.Capture.
//
// Why a separate process rather than a helper the PowerShell loop shells out to:
// each `glasscap <hwnd> out.png` invocation costs ~550 ms (runtime start, D3D11
// device creation, PNG encode), which is two frames per second. The capture
// itself is cheap; the setup is not. Keeping the device and the frame pool alive
// for the whole recording is what makes a real frame rate possible.
//
// The output matches what `frames.ps1` already produces, so the encoder half of
// the pipeline does not change:
//
//   <outDir>/f000000.jpg ...   one JPEG per frame
//   <outDir>/frames.jsonl      {"i":0,"t":0,"file":"f000000.jpg"}
//   <outDir>/meta.json         width, height, sourceWidth, sourceHeight, fps, ...
//   <outDir>/done.json         frames, elapsedMs, error
//
// Usage: wgcrec <hwnd> <outDir> <fps> <quality> <maxEdge> <maxSeconds> <stopFile>
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using WinRT;
using WinRT.Interop;

namespace WgcRec;

internal static class Program
{
    [DllImport("d3d11.dll")]
    static extern int D3D11CreateDevice(IntPtr adapter, int driverType, IntPtr software,
        uint flags, IntPtr featureLevels, uint featureLevelCount, uint sdkVersion,
        out IntPtr device, out int featureLevel, out IntPtr context);

    [DllImport("d3d11.dll")]
    static extern int CreateDirect3D11DeviceFromDXGIDevice(IntPtr dxgiDevice, out IntPtr graphicsDevice);

    [DllImport("combase.dll")]
    static extern int RoInitialize(int initType);

    [DllImport("combase.dll", CharSet = CharSet.Unicode)]
    static extern int WindowsCreateString(string src, int length, out IntPtr hstring);

    [DllImport("combase.dll")]
    static extern int WindowsDeleteString(IntPtr hstring);

    [DllImport("combase.dll")]
    static extern int RoGetActivationFactory(IntPtr activatableClassId, ref Guid iid, out IntPtr factory);

    [DllImport("user32.dll")]
    static extern bool IsWindow(IntPtr h);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr h, out RECT rect);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    // Not projected into .NET: reaching the capture factory from a window handle
    // is only possible through this COM interface.
    [ComImport, Guid("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IWgcItemInterop
    {
        [PreserveSig] int CreateForWindow(IntPtr window, ref Guid iid, out IntPtr result);
        [PreserveSig] int CreateForMonitor(IntPtr monitor, ref Guid iid, out IntPtr result);
    }

    static readonly Guid IID_IDXGIDevice = new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");
    static readonly Guid IID_GraphicsCaptureItem = new Guid("79c3f95b-31f7-4ec2-a464-632ef5d30760");
    static readonly Guid IID_IWgcItemInterop = new Guid("3628E81B-3CAC-4C60-B7F4-23CE0E0C3356");

    static int Main(string[] args)
    {
        if (args.Length < 7)
        {
            Console.Error.WriteLine("usage: wgcrec <hwnd> <outDir> <fps> <quality> <maxEdge> <maxSeconds> <stopFile>");
            return 2;
        }
        if (!long.TryParse(args[0], out long hwndValue) || hwndValue == 0)
        {
            Console.Error.WriteLine("hwnd must be a non-zero decimal window handle");
            return 2;
        }
        string outDir = args[1];
        int fps = Math.Clamp(ParseInt(args[2], 8), 1, 60);
        int quality = Math.Clamp(ParseInt(args[3], 65), 30, 95);
        int maxEdge = Math.Max(ParseInt(args[4], 1920), 0);
        int maxSeconds = Math.Clamp(ParseInt(args[5], 600), 2, 3600);
        string stopFile = args[6];

        Directory.CreateDirectory(outDir);
        var hwnd = new IntPtr(hwndValue);
        if (!IsWindow(hwnd))
        {
            Console.Error.WriteLine("not a window handle: " + hwndValue);
            return 3;
        }

        try
        {
            return Record(hwnd, outDir, fps, quality, maxEdge, maxSeconds, stopFile);
        }
        catch (Exception ex)
        {
            WriteDone(outDir, 0, 0, ex.Message);
            Console.Error.WriteLine("EX " + ex.ToString());
            return 9;
        }
    }

    static int ParseInt(string text, int fallback) =>
        int.TryParse(text, out int value) ? value : fallback;

    /// <summary>
    /// The recording loop. One D3D11 device and one frame pool for the whole run;
    /// everything expensive happens once.
    /// </summary>
    static int Record(IntPtr hwnd, string outDir, int fps, int quality, int maxEdge, int maxSeconds, string stopFile)
    {
        RoInitialize(1);

        IntPtr devicePtr = IntPtr.Zero, contextPtr = IntPtr.Zero, dxgiPtr = IntPtr.Zero, inspectablePtr = IntPtr.Zero;
        uint bgra = 0x20; // D3D11_CREATE_DEVICE_BGRA_SUPPORT
        int hr = D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, bgra, IntPtr.Zero, 0, 7, out devicePtr, out _, out contextPtr);
        if (hr != 0)
            hr = D3D11CreateDevice(IntPtr.Zero, 5, IntPtr.Zero, bgra, IntPtr.Zero, 0, 7, out devicePtr, out _, out contextPtr); // WARP
        if (hr != 0) throw new InvalidOperationException(string.Format("D3D11CreateDevice 0x{0:X8}", hr));

        Guid dxgiId = IID_IDXGIDevice;
        Marshal.QueryInterface(devicePtr, ref dxgiId, out dxgiPtr);
        hr = CreateDirect3D11DeviceFromDXGIDevice(dxgiPtr, out inspectablePtr);
        if (hr != 0) throw new InvalidOperationException(string.Format("CreateDirect3D11DeviceFromDXGIDevice 0x{0:X8}", hr));
        // C#/WinRT projects these; Marshal.GetObjectForIUnknown does not.
        var device = MarshalInspectable<IDirect3DDevice>.FromAbi(inspectablePtr);

        string className = "Windows.Graphics.Capture.GraphicsCaptureItem";
        WindowsCreateString(className, className.Length, out IntPtr hClass);
        Guid interopIid = IID_IWgcItemInterop;
        hr = RoGetActivationFactory(hClass, ref interopIid, out IntPtr factoryPtr);
        WindowsDeleteString(hClass);
        if (hr != 0) throw new InvalidOperationException(string.Format("RoGetActivationFactory 0x{0:X8}", hr));
        var interop = (IWgcItemInterop)Marshal.GetObjectForIUnknown(factoryPtr);

        Guid itemIid = IID_GraphicsCaptureItem;
        hr = interop.CreateForWindow(hwnd, ref itemIid, out IntPtr itemPtr);
        if (hr != 0 || itemPtr == IntPtr.Zero) throw new InvalidOperationException(string.Format("CreateForWindow 0x{0:X8}", hr));
        var item = MarshalInspectable<GraphicsCaptureItem>.FromAbi(itemPtr);

        int sourceWidth = item.Size.Width;
        int sourceHeight = item.Size.Height;
        int outWidth = sourceWidth, outHeight = sourceHeight;
        if (maxEdge > 0)
        {
            double scale = Math.Min(1.0, (double)maxEdge / Math.Max(sourceWidth, sourceHeight));
            outWidth = (int)Math.Round(sourceWidth * scale);
            outHeight = (int)Math.Round(sourceHeight * scale);
        }
        // VP9 dislikes odd dimensions; the encoder half expects even sizes.
        outWidth -= outWidth % 2;
        outHeight -= outHeight % 2;

        WriteMeta(outDir, outWidth, outHeight, sourceWidth, sourceHeight, fps, hwnd.ToInt64());

        var framesPath = Path.Combine(outDir, "frames.jsonl");
        var stopwatch = Stopwatch.StartNew();
        int index = 0;
        // Set once the first frame is on disk: the recorder waits for READY
        // before it reports the recording as started.
        bool announced = false;
        string error = null;
        // The last frame's raw pixels, so a still page can be re-emitted
        // without asking the capture for a new one.
        byte[] lastBytes = null;

        var pool = Direct3D11CaptureFramePool.CreateFreeThreaded(device, DirectXPixelFormat.B8G8R8A8UIntNormalized, 2, item.Size);
        var session = pool.CreateCaptureSession(item);
        Direct3D11CaptureFrame pending = null;
        using var frameReady = new AutoResetEvent(false);
        pool.FrameArrived += (sender, _) =>
        {
            var next = sender.TryGetNextFrame();
            if (next == null) return;
            Interlocked.Exchange(ref pending, next)?.Dispose();
            frameReady.Set();
        };

        using (var writer = new StreamWriter(framesPath, false, new System.Text.UTF8Encoding(false)) { AutoFlush = true })
        {
            session.StartCapture();
            long baseTicks = -1;
            while (true)
            {
                if (stopwatch.Elapsed.TotalSeconds >= maxSeconds) break;
                if (!string.IsNullOrEmpty(stopFile) && File.Exists(stopFile)) break;

                long targetMs = (long)(index * 1000.0 / fps);
                long waitMs = targetMs - stopwatch.ElapsedMilliseconds;
                if (waitMs > 0) frameReady.WaitOne((int)waitMs);

                // WGC pushes a frame only when the surface CHANGED. A still page
                // delivers one frame and then nothing, so an empty read here is
                // not an error: keep the last bitmap and repeat it. Without this
                // a five-second recording of a static screen produced one frame.
                var frame = Interlocked.Exchange(ref pending, null);
                if (frame == null)
                {
                    if (lastBytes == null) continue;
                    string repeat = string.Format("f{0:d6}.jpg", index);
                    SaveJpeg(lastBytes, Path.Combine(outDir, repeat), sourceWidth, sourceHeight, outWidth, outHeight, quality);
                    if (baseTicks < 0) baseTicks = stopwatch.ElapsedMilliseconds;
                    long repeatTicks = stopwatch.ElapsedMilliseconds - baseTicks;
                    writer.WriteLine("{\"i\":" + index + ",\"t\":" + repeatTicks + ",\"file\":\"" + repeat + "\"}");
                    index++;
                    if (!announced) { announced = true; Console.WriteLine("READY"); }
                    continue;
                }
                try
                {
                    var bitmap = SoftwareBitmap.CreateCopyFromSurfaceAsync(frame.Surface).AsTask().GetAwaiter().GetResult();
                    var converted = SoftwareBitmap.Convert(bitmap, BitmapPixelFormat.Bgra8, BitmapAlphaMode.Ignore);
                    string file = string.Format("f{0:d6}.jpg", index);
                    lastBytes = ReadPixels(converted, sourceWidth, sourceHeight);
                    SaveJpeg(lastBytes, Path.Combine(outDir, file), sourceWidth, sourceHeight, outWidth, outHeight, quality);
                    if (baseTicks < 0) baseTicks = stopwatch.ElapsedMilliseconds;
                    long frameTicks = stopwatch.ElapsedMilliseconds - baseTicks;
                    writer.WriteLine("{\"i\":" + index + ",\"t\":" + frameTicks + ",\"file\":\"" + file + "\"}");
                    index++;
                    if (!announced) { announced = true; Console.WriteLine("READY"); }
                }
                finally
                {
                    frame.Dispose();
                }
            }
            session.Dispose();
            pool.Dispose();
        }

        WriteDone(outDir, index, stopwatch.ElapsedMilliseconds, error);
        Console.WriteLine("DONE " + index + " in " + stopwatch.ElapsedMilliseconds + "ms");
        return 0;
    }

    /// <summary>Copy a SoftwareBitmap into a JPEG on disk, scaling when asked.</summary>
    /// <summary>Copy one frame's pixels out of its SoftwareBitmap.</summary>
    static byte[] ReadPixels(SoftwareBitmap bitmap, int sourceWidth, int sourceHeight)
    {
        // CopyToBuffer hands back zeros for a Convert(...) result: the converted
        // bitmap is a new object whose buffer is not exposed the way the capture
        // surface's is. Locking the buffer and asking its ABI for the memory is
        // the path that carries pixels.
        int stride = sourceWidth * 4;
        var bytes = new byte[stride * sourceHeight];
        using (var locked = bitmap.LockBuffer(BitmapBufferAccessMode.Read))
        using (var reference = locked.CreateReference())
        {
            // C#/WinRT wraps the reference in IInspectable, which [ComImport]
            // cannot cast from. The ABI pointer can be queried for the byte-access
            // interface directly.
            IntPtr unknown = ((IWinRTObject)reference).NativeObject.ThisPtr;
            Guid iid = typeof(IMemoryBufferByteAccess).GUID;
            Marshal.QueryInterface(unknown, ref iid, out IntPtr accessPtr);
            if (accessPtr == IntPtr.Zero) throw new InvalidOperationException("the frame buffer does not expose its bytes");
            try
            {
                var access = (IMemoryBufferByteAccess)Marshal.GetObjectForIUnknown(accessPtr);
                access.GetBuffer(out IntPtr data, out uint capacity);
                if (capacity == 0) throw new InvalidOperationException("the frame buffer is empty");
                Marshal.Copy(data, bytes, 0, (int)Math.Min(capacity, (uint)bytes.Length));
            }
            finally
            {
                Marshal.Release(accessPtr);
            }
        }
        return bytes;
    }

    // The WinRT ABI that exposes a locked buffer's memory. Not projected into
    // the managed surface, so it is declared here.
    [ComImport, Guid("5B0D3235-4DBA-4D44-865E-8F1D0E4FD04D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMemoryBufferByteAccess
    {
        void GetBuffer(out IntPtr buffer, out uint capacity);
    }

    /// <summary>A cheap sum over a slice, for diagnostics only.</summary>
    static long Sample(byte[] bytes)
    {
        long total = 0;
        for (int i = 0; i < bytes.Length; i += 997) total += bytes[i];
        return total;
    }

    /// <summary>Write one frame to disk, scaling when asked.</summary>
    static void SaveJpeg(byte[] bytes, string path, int sourceWidth, int sourceHeight, int width, int height, int quality)
    {
        using var full = new Bitmap(sourceWidth, sourceHeight, PixelFormat.Format32bppArgb);
        var data = full.LockBits(new Rectangle(0, 0, sourceWidth, sourceHeight), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try
        {
            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        }
        finally
        {
            full.UnlockBits(data);
        }

        Bitmap source = full;
        Bitmap scaled = null;
        if (width != sourceWidth || height != sourceHeight)
        {
            scaled = new Bitmap(width, height, PixelFormat.Format32bppArgb);
            using (var graphics = Graphics.FromImage(scaled))
            {
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
                graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                graphics.DrawImage(full, 0, 0, width, height);
            }
            source = scaled;
        }

        var codec = ImageCodecInfo.GetImageEncoders();
        ImageCodecInfo jpeg = null;
        foreach (var candidate in codec)
        {
            if (candidate.MimeType == "image/jpeg") { jpeg = candidate; break; }
        }
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(Encoder.Quality, (long)quality);
        try { source.Save(path, jpeg, parameters); }
        finally { scaled?.Dispose(); }
    }

    static void WriteMeta(string outDir, int width, int height, int sourceWidth, int sourceHeight, int fps, long hwnd)
    {
        string json = "{\"width\":" + width + ",\"height\":" + height
            + ",\"sourceWidth\":" + sourceWidth + ",\"sourceHeight\":" + sourceHeight
            + ",\"fps\":" + fps + ",\"hwnd\":" + hwnd
            + ",\"source\":\"wgc\""
            + ",\"startedAt\":" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "}";
        File.WriteAllText(Path.Combine(outDir, "meta.json"), json);
    }

    static void WriteDone(string outDir, int frames, long elapsedMs, string error)
    {
        string json = "{\"frames\":" + frames + ",\"elapsedMs\":" + elapsedMs
            + ",\"error\":" + (error == null ? "null" : "\"" + error.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"") + "}";
        File.WriteAllText(Path.Combine(outDir, "done.json"), json);
    }
}

