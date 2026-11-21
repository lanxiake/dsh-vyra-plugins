/**
 * 子进程输出解码：默认 UTF-8；出现替换字符（中文 Windows 的 GBK 输出）时改用 GBK 重解。
 * 用 StringDecoder 跨 chunk 缓冲，避免 UTF-8 多字节字符被 chunk 边界切断后误判为 GBK。
 */
import { StringDecoder } from 'node:string_decoder'

export class OutputDecoder {
  private readonly utf8 = new StringDecoder('utf8')

  push(chunk: Buffer): string {
    const text = this.utf8.write(chunk)
    if (!text.includes('\uFFFD')) return text
    try {
      const gbk = new TextDecoder('gbk').decode(chunk)
      // GBK 能完整解出且含中文才采用：纯 ASCII 或仍有替换字符时保持 UTF-8 结果
      if (!gbk.includes('\uFFFD') && /[\u4e00-\u9fff]/.test(gbk)) return gbk
    } catch {
      // 无完整 ICU（TextDecoder 不支持 gbk）时退回 UTF-8 结果
    }
    return text
  }
}
