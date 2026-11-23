// Windows 系统声音回环采集（WASAPI loopback，C# 5 语法）。
//
// 录的是默认播放设备正在输出的声音，不依赖 Stereo Mix / 虚拟声卡 / ffmpeg。
// 后台线程持续排空 WASAPI 缓冲并写入 WAV；Stop() 时补 WAV 头。
// 采样格式通常是 48kHz / 32-bit float / 立体声（WAVEFORMATEXTENSIBLE）。
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator
{
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr ppEndpoint);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice
{
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IntPtr ppInterface);
}

[ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioClient
{
    [PreserveSig] int Initialize(int ShareMode, int StreamFlags, long hnsBufferDuration, long hnsPeriodicity, IntPtr pFormat, IntPtr AudioSessionGuid);
    [PreserveSig] int GetBufferSize(out uint pNumBufferFrames);
    [PreserveSig] int GetStreamLatency(out long phnsLatency);
    [PreserveSig] int GetCurrentPadding(out uint pNumPaddingFrames);
    [PreserveSig] int IsFormatSupported(IntPtr pFormat, out IntPtr ppClosestMatch);
    [PreserveSig] int GetMixFormat(out IntPtr ppDeviceFormat);
    [PreserveSig] int GetDevicePeriod(out long phnsDefaultDevicePeriod, out long phnsMinimumDevicePeriod);
    [PreserveSig] int Start();
    [PreserveSig] int Stop();
    [PreserveSig] int Reset();
    [PreserveSig] int SetEventHandle(IntPtr eventHandle);
    [PreserveSig] int GetService(ref Guid riid, out IntPtr ppv);
}

[ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioCaptureClient
{
    [PreserveSig] int GetBuffer(out IntPtr ppData, out uint pNumFramesToRead, out uint pdwFlags, out ulong pu64DevicePosition, out ulong pu64QPCPosition);
    [PreserveSig] int ReleaseBuffer(uint NumFramesRead);
    [PreserveSig] int GetNextPacketSize(out uint pNumFramesInNextPacket);
}

[StructLayout(LayoutKind.Sequential, Pack = 2)]
public struct WAVEFORMATEX
{
    public ushort wFormatTag;
    public ushort nChannels;
    public uint nSamplesPerSec;
    public uint nAvgBytesPerSec;
    public ushort nBlockAlign;
    public ushort wBitsPerSample;
    public ushort cbSize;
}

[StructLayout(LayoutKind.Sequential, Pack = 2)]
public struct WAVEFORMATEXTENSIBLE
{
    public WAVEFORMATEX Format;
    public ushort Samples;
    public uint ChannelMask;
    public Guid SubFormat;
}

public sealed class WasapiRecorder
{
    private const int AUDCLNT_STREAMFLAGS_LOOPBACK = 0x00020000;
    private const int REFTIMES_PER_SEC = 10000000;

    private IAudioClient client;
    private IAudioCaptureClient capture;
    private FileStream stream;
    private Thread thread;
    private ManualResetEvent ready;
    private volatile bool stopping;
    private Exception failure;
    private string path;
    private WAVEFORMATEX format;
    private ushort formatTag;
    private long dataBytes;
    private int maxSeconds;

    private WasapiRecorder()
    {
    }

    /** 启动后台采集；初始化失败会抛异常。 */
    public static WasapiRecorder Start(string path, int maxSeconds)
    {
        WasapiRecorder recorder = new WasapiRecorder();
        recorder.path = path;
        recorder.maxSeconds = maxSeconds <= 0 ? 600 : maxSeconds;
        recorder.ready = new ManualResetEvent(false);
        recorder.thread = new Thread(recorder.CaptureThread);
        recorder.thread.IsBackground = true;
        recorder.thread.Name = "vyra-wasapi-loopback";
        recorder.thread.Start();

        if (!recorder.ready.WaitOne(8000))
        {
            recorder.stopping = true;
            throw new Exception("WASAPI initialization timed out");
        }
        if (recorder.failure != null)
        {
            throw new Exception("WASAPI initialization failed: " + recorder.failure.Message);
        }
        return recorder;
    }

    /** 停止采集并补 WAV 头。可重复调用。 */
    public void Stop()
    {
        stopping = true;
        if (thread != null)
        {
            try { thread.Join(8000); } catch { }
        }
        PatchHeader();
        if (stream != null)
        {
            try { stream.Dispose(); } catch { }
            stream = null;
        }
    }

    /** 采集到的字节数与格式描述（诊断用）。 */
    public string Info
    {
        get
        {
            return string.Format("tag=0x{0:X4} channels={1} rate={2} bits={3} bytes={4}",
                formatTag, format.nChannels, format.nSamplesPerSec, format.wBitsPerSample, dataBytes);
        }
    }

    private void CaptureThread()
    {
        IntPtr devicePtr = IntPtr.Zero;
        IntPtr clientPtr = IntPtr.Zero;
        IntPtr capturePtr = IntPtr.Zero;
        IntPtr mixPtr = IntPtr.Zero;
        bool comInitialized = false;
        try
        {
            try { CoInitializeEx(IntPtr.Zero, 0); comInitialized = true; } catch { }

            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)(object)new MMDeviceEnumeratorComObject();
            int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out devicePtr);
            if (hr != 0) throw new Exception("GetDefaultAudioEndpoint 0x" + hr.ToString("X8"));
            IMMDevice device = (IMMDevice)Marshal.GetObjectForIUnknown(devicePtr);

            Guid clientIid = typeof(IAudioClient).GUID;
            hr = device.Activate(ref clientIid, 1, IntPtr.Zero, out clientPtr);
            if (hr != 0) throw new Exception("Activate 0x" + hr.ToString("X8"));
            client = (IAudioClient)Marshal.GetObjectForIUnknown(clientPtr);

            hr = client.GetMixFormat(out mixPtr);
            if (hr != 0) throw new Exception("GetMixFormat 0x" + hr.ToString("X8"));
            format = (WAVEFORMATEX)Marshal.PtrToStructure(mixPtr, typeof(WAVEFORMATEX));

            formatTag = format.wFormatTag;
            if (format.wFormatTag == 0xFFFE)
            {
                WAVEFORMATEXTENSIBLE ext = (WAVEFORMATEXTENSIBLE)Marshal.PtrToStructure(mixPtr, typeof(WAVEFORMATEXTENSIBLE));
                byte[] guid = ext.SubFormat.ToByteArray();
                // KSDATAFORMAT_SUBTYPE_PCM = 00000001-0000-0010-8000-00aa00389b71
                // KSDATAFORMAT_SUBTYPE_IEEE_FLOAT = 00000003-0000-0010-8000-00aa00389b71
                if (guid[0] == 3) formatTag = 3;
                else if (guid[0] == 1) formatTag = 1;
                else formatTag = 1;
            }
            if (formatTag != 1 && formatTag != 3)
                throw new Exception("unsupported mix format tag 0x" + formatTag.ToString("X4"));

            hr = client.Initialize(0, AUDCLNT_STREAMFLAGS_LOOPBACK, 2L * REFTIMES_PER_SEC, 0, mixPtr, IntPtr.Zero);
            if (hr != 0) throw new Exception("Initialize 0x" + hr.ToString("X8"));

            Guid captureIid = typeof(IAudioCaptureClient).GUID;
            hr = client.GetService(ref captureIid, out capturePtr);
            if (hr != 0) throw new Exception("GetService 0x" + hr.ToString("X8"));
            capture = (IAudioCaptureClient)Marshal.GetObjectForIUnknown(capturePtr);

            stream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.Read);
            byte[] blank = new byte[44];
            stream.Write(blank, 0, blank.Length);

            hr = client.Start();
            if (hr != 0) throw new Exception("Start 0x" + hr.ToString("X8"));

            ready.Set();

            long started = Environment.TickCount;
            while (!stopping)
            {
                if ((Environment.TickCount - started) / 1000 >= maxSeconds) break;
                bool drained = false;
                uint packet;
                capture.GetNextPacketSize(out packet);
                while (packet != 0)
                {
                    IntPtr data;
                    uint frames;
                    uint flags;
                    ulong devicePosition;
                    ulong qpcPosition;
                    hr = capture.GetBuffer(out data, out frames, out flags, out devicePosition, out qpcPosition);
                    if (hr != 0) break;
                    int bytes = (int)frames * format.nBlockAlign;
                    if (bytes > 0)
                    {
                        byte[] buffer = new byte[bytes];
                        Marshal.Copy(data, buffer, 0, bytes);
                        stream.Write(buffer, 0, bytes);
                        dataBytes += bytes;
                    }
                    capture.ReleaseBuffer(frames);
                    drained = true;
                    capture.GetNextPacketSize(out packet);
                }
                if (!drained) Thread.Sleep(10);
            }

            try { client.Stop(); } catch { }
        }
        catch (Exception error)
        {
            failure = error;
            ready.Set();
        }
        finally
        {
            if (capturePtr != IntPtr.Zero) { try { Marshal.Release(capturePtr); } catch { } }
            if (clientPtr != IntPtr.Zero) { try { Marshal.Release(clientPtr); } catch { } }
            if (devicePtr != IntPtr.Zero) { try { Marshal.Release(devicePtr); } catch { } }
            if (mixPtr != IntPtr.Zero) { try { Marshal.FreeCoTaskMem(mixPtr); } catch { } }
            if (comInitialized) { try { CoUninitialize(); } catch { } }
        }
    }

    private void PatchHeader()
    {
        if (stream == null) return;
        try
        {
            long data = dataBytes;
            if (data > 0xFFFFFFFFL - 36) data = 0xFFFFFFFFL - 36;
            stream.Seek(0, SeekOrigin.Begin);
            BinaryWriter writer = new BinaryWriter(stream);
            writer.Write(new byte[] { (byte)'R', (byte)'I', (byte)'F', (byte)'F' });
            writer.Write((uint)(36 + data));
            writer.Write(new byte[] { (byte)'W', (byte)'A', (byte)'V', (byte)'E' });
            writer.Write(new byte[] { (byte)'f', (byte)'m', (byte)'t', (byte)' ' });
            writer.Write((uint)16);
            writer.Write((ushort)formatTag);
            writer.Write(format.nChannels);
            writer.Write(format.nSamplesPerSec);
            writer.Write(format.nAvgBytesPerSec);
            writer.Write(format.nBlockAlign);
            writer.Write(format.wBitsPerSample);
            writer.Write(new byte[] { (byte)'d', (byte)'a', (byte)'t', (byte)'a' });
            writer.Write((uint)data);
            writer.Flush();
            stream.Seek(0, SeekOrigin.End);
        }
        catch
        {
            // 头部补写失败时保留原始 PCM 数据；客户端会按「无音频」处理。
        }
    }

    [DllImport("ole32.dll")]
    private static extern int CoInitializeEx(IntPtr pvReserved, uint dwCoInit);
    [DllImport("ole32.dll")]
    private static extern void CoUninitialize();
}
