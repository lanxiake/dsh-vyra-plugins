/**
 * 备份文件里的密码,用用户自己设的口令加密,而不是用本机的钥匙串——钥匙串绑在
 * 这一台机器、这一个用户上,把它的密文装进备份等于换台机器就打不开。
 *
 * 格式与 liteshell 的 sealed.ts 逐字节兼容(scrypt + AES-256-GCM),这样两边导出的
 * 备份可以互相导入。纯 node crypto,不引 Electron,测试脚本可以直接跑。
 */
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'

/** scrypt 的花费是「备份文件被拿走」和「里面的每个 root 密码」之间唯一的东西。 */
const KDF = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

const keyFrom = (passphrase, salt) => scryptSync(String(passphrase), salt, 32, KDF)

export function sealSecrets(secrets, passphrase) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv)
  const data = Buffer.concat([c.update(JSON.stringify(secrets), 'utf8'), c.final()])
  return {
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: data.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
  }
}

/** 口令错了或文件被改过都会抛:GCM 的 tag 就是那个检查,绕不过去。 */
export function openSecrets(sealed, passphrase) {
  if (sealed?.kdf !== 'scrypt') throw new Error('不认识的加密方式')
  const d = createDecipheriv('aes-256-gcm', keyFrom(passphrase, Buffer.from(sealed.salt, 'base64')), Buffer.from(sealed.iv, 'base64'))
  d.setAuthTag(Buffer.from(sealed.tag, 'base64'))
  const json = Buffer.concat([d.update(Buffer.from(sealed.data, 'base64')), d.final()]).toString('utf8')
  return JSON.parse(json)
}
