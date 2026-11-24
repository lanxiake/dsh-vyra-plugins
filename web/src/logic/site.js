/**
 * 站点级常量。仓库地址只在这里出现一次，其余位置一律从这里取。
 * 与根 package.json 的 repository 字段保持一致。
 */
export const SITE = {
  owner: 'lanxiake',
  repo: 'lanxiake/dsh-vyra-plugins',
  repoUrl: 'https://github.com/lanxiake/dsh-vyra-plugins',
  branch: 'master',
}

/** 站点自身的索引源地址（与 README / docs 保持一致） */
export const INDEX_URLS = {
  domestic:
    'https://ghproxy.net/https://raw.githubusercontent.com/' +
    SITE.repo +
    '/' +
    SITE.branch +
    '/docs/index.json',
  overseas:
    'https://raw.githubusercontent.com/' + SITE.repo + '/' + SITE.branch + '/docs/index-github.json',
}
