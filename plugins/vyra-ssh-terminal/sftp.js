/**
 * SFTP 操作封装:列目录、读写文件、mkdir、rename、remove
 */

/**
 * 列目录
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} remotePath
 * @returns {Promise<Array<{ name: string, isDir: boolean, size: number, mtime: number, mode: number }>>}
 */
export async function listDir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) return reject(err)
      resolve(
        list.map((item) => ({
          name: item.filename,
          isDir: (item.attrs.mode & 0o170000) === 0o040000,
          size: item.attrs.size,
          mtime: item.attrs.mtime * 1000,
          mode: item.attrs.mode & 0o777,
        }))
      )
    })
  })
}

/**
 * 读文件
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} remotePath
 * @returns {Promise<Buffer>}
 */
export async function readFile(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })
}

/**
 * 写文件(覆盖)
 * @param {import('ssh2').SFTPWrapper} sftp
 * @param {string} remotePath
 * @param {Buffer|string} data
 */
export async function writeFile(sftp, remotePath, data) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, data, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 创建目录
 */
export async function mkdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 重命名/移动
 */
export async function rename(sftp, oldPath, newPath) {
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 删除文件
 */
export async function unlink(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 删除目录(非递归)
 */
export async function rmdir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

/**
 * 递归删除目录
 */
export async function removeRecursive(sftp, remotePath) {
  const entries = await listDir(sftp, remotePath)
  for (const entry of entries) {
    const fullPath = `${remotePath}/${entry.name}`
    if (entry.isDir) {
      await removeRecursive(sftp, fullPath)
    } else {
      await unlink(sftp, fullPath)
    }
  }
  await rmdir(sftp, remotePath)
}

/** 规范化路径(用来取家目录:realpath('.'))。 */
export async function realpath(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.realpath(remotePath, (err, abs) => (err ? reject(err) : resolve(abs)))
  })
}

/**
 * stat
 */
export async function stat(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, attrs) => {
      if (err) return reject(err)
      resolve({
        isDir: (attrs.mode & 0o170000) === 0o040000,
        size: attrs.size,
        mtime: attrs.mtime * 1000,
        mode: attrs.mode & 0o777,
      })
    })
  })
}
