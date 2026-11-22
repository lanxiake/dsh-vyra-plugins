# Changelog

## Unreleased

## 0.42.0 — 2026-11-22

### 播放控制

- 设置 →「播放与音频」更名为「播放控制」，按 Folia 分为「Folia 智能过渡 / 声音与设备 / 播放行为」三组，插件自有的启动、在线音质、播放上报、音频焦点、睡眠定时收进最后一组「插件」（不加 Folia 的页签条，用 DSH 的分组卡片）。
- 声音与设备：声卡行改为「当前播放声卡」并可刷新；ReplayGain 从下拉改为 Folia 的分段控件，文案沿用「响度平衡」的说法；暂停/播放淡入淡出沿用。
- 播放行为新增四项：`加入队列的默认位置`（歌曲菜单新增「加入队列」，按设置追加到末尾或当前曲之后）、`无法播放时自动跳过`（在线歌曲因权限/地区/地址失效失败时跳到下一首，连续失败会停下）、`一轮不重复`（打乱播放每轮重新洗牌）、`播放时阻止休眠`（Wake Lock，不支持时置灰并说明）；语音输入时暂停播放并入该组。
- 与 Folia 桌面端的差异：`播放引擎（Web Audio / mpv）`与`自动转换无法播放的音频（FFmpeg）`只在 Folia 桌面端出现，本插件是 Web 客户端，不提供；智能过渡只有自动交叉淡入淡出（Folia 的 crossfade 模式），没有 automix。
- 内部逻辑按 Folia 源码对齐：睡眠定时改为插件生命周期内的单次倒计时（折叠面板也到点暂停）；ReplayGain 在播放器内按曲解析并应用（专辑回退单曲、正增益按 peak 防削波、无标签按原音量），面板只负责显示；「一轮不重复」改用 Folia 的 `shuffleRound`（记录每轮已听、整轮重洗、当前曲钉在最前），交叉淡化不再绕过它；在线音质在每次播放时现场解析流地址，队列里的旧歌也按新音质播。

### 歌词

- 设置 → 歌词按 Folia 的页面重排为三组「歌词来源 / 时间与过滤 / 本地歌词文件格式优先级」，插件自有的显示项（显示翻译、字幕背景、歌词字号、翻译字体缩放、输入框歌词/翻译）收进最后一组「插件」；不加上方的页签条，沿用 DSH 的设置卡片与分组标题。
- 「首选歌词来源」更名为「歌词匹配优先级」（Folia 的叫法），支持 QQ 音乐、网易云音乐、AMLLDB、酷狗音乐、汽水音乐。
- 新增「保留平台自带的逐字歌词」（Folia 的 `keepProviderWordTiming`，默认开）：平台自带的歌词有逐字时间轴时，只向「歌词匹配优先级」选中的来源要逐字歌词，逐字才替换、行级不采纳也不写回；关闭后按优先级在所有来源里择优。
- 新增「全局时间偏移」（±2000 ms，Folia 的设备级补偿）：与单曲偏移相加，播放页歌词舞台、输入框歌词条共用同一时钟；「调整」打开草稿窗口，提供 ±50 / ±10 微调与归零，点「应用」才保存。点击歌词行时按叠加后的偏移反算 seek 位置，不会点一句跳去相邻一句。
- 「歌词过滤」从设置页的三行收进独立窗口（规则不变，立即生效）；「本地歌词文件格式优先级」收进可展开分组，保留上下移动并补「恢复默认」。
- 设置 → 歌词「字体大小」不再是一串没人读的 px：改绑真实生效的字号倍率（70%–150%），与播放器外观面板的 ≋ 按钮同源；「翻译字体缩放」统一到 50%–150%，与 ↔ 按钮一致。
- 删除四个只写不读的排版项：字体大小（px）、歌词间距、模糊非当前歌词、歌词对齐方式——它们只作用于已移除的经典歌词列表；Folia 样式的对齐与行距由样式自身决定，没有全局开关。
- 「字幕背景」在莫奈（Monet）/ 静止样式下置灰并说明原因：这两个样式自己绘制译文行，不经过 Folia 的字幕叠层，开关本来就不生效。
- 时计（pendolo）样式补上字号倍率、翻译缩放与翻译开关：此前宿主把这三个值写死成 1 / 1 / 显示，切到这个样式后设置全失效。
- 清理经典歌词列表残留：删除 `lyrics-scroll.js`（refs 永远接不上的自动滚动）、`text-styles.js`、`--mp-lyric-size` / `--mp-line-gap` / `mp-align-*` / `is-blur` 等 CSS 钩子，以及播放页的 inert 手动浏览状态；旧的 `lyricSize` / `lyricGap` / `lyricBlur` / `lyricAlign` 持久化值在读取时丢弃。
- 匹配歌词窗口的搜索框只自动填入歌名（此前是「歌名 - 歌手 - 专辑」）：各平台搜索只接受一个字符串，长查询会把歌名埋在后面，结果全是同名不同版；歌手/专辑/时长仍随请求提交，排序照旧按元数据打分。

### 存储与备份

- 设置 →「存储与数据」更名为「存储与备份」，按 Folia 分为「媒体缓存 / 缓存详情 / 本地文件夹监视 / 备份与导入」四组，清空所有数据留在「危险操作」（不加顶部页签条）。
- 媒体缓存：新增「缓存目录」（显示当前路径、在文件管理器中打开、用文件夹选择器切换；Host 配置 `cacheDir`，默认 `<DSH_HOME>/music/cache`，切换即时生效，旧目录缓存不迁移）；「缓存上限」改为下拉；补「已缓存歌曲」一行。
- 缓存详情：歌单数据、歌词（含批量导出）、封面、媒体文件、分析数据、智能平衡数据逐行显示体积并可单独清除；组头「全部清空」一次清这六类。清歌词会同时清掉逐字偏移记忆与分词记录，分析/平衡会同时清 localStorage 与模块内存，不再「清完播一首又长回来」。
- 新增 Host `POST /data/export-lyrics`：把已缓存歌词按歌曲名导出到 `<data>/exports/lyrics-<时间>/`，导出后直接打开该目录。
- 本地文件夹监视：开关写入 Host 配置 `watchFolders`；开启后用 `fs.watch` 监听已导入目录，2 秒防抖、30 秒最小间隔地全量重扫，并递增 `/library/revision`，面板按版本号刷新曲库。
- 备份与导入：导出/导入一个 JSON（客户端偏好 + Host 配置），只含设置与音乐目录，不含缓存、歌词正文与登录凭证；导入只接受已知偏好键。
- `/data/clear` 支持 `category` 单类清空，settings / accounts 不允许单独清；缓存根语义改为「`createMediaCache` 的 `dir` 就是缓存根」，默认仍是 `<data>/cache`。


### 在线播放

- 修复 issue #28：网易云无损 / 高解析档在海外（荷兰）立即失败。CDN 把真实的 FLAC 标成 `audio/mpeg`，Host 原来原样透传，客户端于是按 MIME 选了 MSE，append 时解码失败。Host 现在在写响应头前读第一块并嗅探容器（`fLaC` / `OggS` / `RIFF` / `ID3` / `ftyp` / MP3 帧同步），实时流与媒体缓存副本都以嗅探结果为准；嗅探只在请求从 0 开始时做，后面的 Range 仍按原逻辑。客户端保留 MSE（为了可控 seek），但 MSE 解码失败时会像 Folia 一样退回直连媒体元素再试一次。

### 队列

- 队列只剩一套界面：删除输入框浮层、播放器卡片与播放页各自的队列列表（`queue.js` 的 `QueuePopover` / `QueueList` / `QueuePanel`、播放器卡片的队列页签、`music-queue` 浮层挂载），全部指向音乐面板里那份带「正在播放 / 接下来播放」的队列。
- 修复面板「接下来播放」不从当前位置开始：原来渲染「播放顺序 − 当前曲」，第 5 首在放时会把第 1–4 首也列成"接下来"，现在从当前曲之后切分，随机顺序同样成立；已播过的曲目不再出现在此段。
- 面板队列的开合状态移到 `p3QueueStore`：输入框的列表按钮先让宿主把面板切出来再显示队列，离开面板时重置，重开不会残留上次的队列。
- 队列里正在播放的那一行，序号换成实时音波（暂停时回落成静态小波）；行上补 `aria-current`，滚到列表别处也能一眼看到哪首在响。
- 播放页的队列按钮改为在按钮旁边弹出同一份队列（浮层右对齐按钮、开在按钮上方，按钮再点一次或点空白收起），不再退回主页；队列组件只有一份，播放页只是它的另一个落点，Esc 先收队列再退页面。

### 输入框

- 输入框旁的播放控件合并成一个「列表按钮」：原来的暂停按钮与队列按钮是两个相邻控件、指向同一个对象（当前歌曲），在输入栏里既占宽度，播放图标又只有 28px 命中区。现在只留一个按钮，点开就是队列；暂停/继续仍在侧栏音乐行的传输控件里，一键可达，队列弹层的位置与外部点击关闭沿用原锚点。
- 设置 → 外观新增「输入框列表按钮」开关（默认开）：关闭后输入框不再渲染这个控件，歌词条仍由「歌词 → 输入框歌词」单独控制。关闭开关时若队列弹层正开着，一并收起，避免留下没有锚点的浮层。

### 设置页审计（未生效与半生效项）

- 外观：主题来源选「自定义」时原来没有任何写入口，强调色永远是空值；现在选中后显示色值输入（如 `#f2607a`，留空回退默认色）。「宿主组件」诊断改为逐个检查面板实际使用的组件，区分 native / partial / fallback，不再只看宿主包是否 require 成功。
- 音乐库：文件夹行的「显示/隐藏」开关写 `hiddenRoots`，但 `POST /config` 从未接收这个字段，点击只会回弹并白跑一次全量扫描；路由现在接收并按 roots 过滤。根目录校验从「任一条失效就整单 400」改为只拒绝**新增**的失效目录，已配置目录离线时仍可增删其它目录（扫描器照旧逐条警告）。
- 音乐库文案：删除扫描器不支持的 AIFF/WMA/APE；「添加」按钮不再写「创建」，成功提示改说文件夹数量；空库提示不再让用户「点刷新」（添加即扫描）。
- 在线与账号：Navidrome 表单用已保存的服务器地址与用户名回填；已连接卡片显示「完整曲库已启用 / 仅基础曲库」，并说明重新连接才能改「保存密码」；登录页脚注不再承诺本页没有的音质设置。
- 播放控制：过渡开关与过渡上限拆成两个持久化值（Folia 的 `automixEnabled` / `crossfadeMaxSec`），关一次再开不会把用户设的 12 秒清成 5 秒；旧数据按「秒数 > 0」迁移。
- 播放控制：「恢复后自动播放」在「启动时恢复上次播放」关闭时置灰并说明依赖关系，不再是点了没反应的死控件。
- 播放控制：在线曲目也会消费启动恢复的曲内位置与「每首歌记住播放位置」；MSE 与直连回退两条路径都在首个可 seek 点应用，不再只有本地文件生效。
- 播放控制：音频焦点的「避让后音量 / 渐变时间」现在同步给 Host，作为跨进程 duck 调用未显式传参时的默认值，不再固定 0.3 / 300ms。
- 存储与备份：按类别清空时补删 `favorites.json.bak` / `playlists.json.bak` / `stats.json.bak` / `lyric-states.json.bak`，并同时失效 favorites / playlists / stats / playback / lyric 的内存缓存；此前清空后下一次写入或重启会把整份旧数据写回。
- 存储与备份：清歌词额外失效歌词加载器的 12 首内存缓存，并通知播放页与输入框歌词条重新读取；清空后当前曲不再继续显示刚删掉的歌词。
- 存储与备份：缓存目录切换前用临时文件验证可写，切换后刷新尺寸行；缓存上限的裁剪把封面计入总量，封面不再无界增长。
- 存储与备份：备份导出前重新读取 Host 配置，导入补回 `hiddenRoots`；从另一台机器导入时跳过本机不存在的目录、缓存目录不可写时去掉该项重试，并提示跳过数量；FileReader 失败会复位「导入中」。
- 歌词：没有可解析文档的旧 Host 歌词也会应用「歌词过滤」的行规则；「自动使用最佳歌词」在搜索途中关掉后，返回的匹配不再替换当前歌词。

## 0.41.0 — 2026-11-21

### 模型控制

- 修复面板折叠或从未打开时 `music_control` 完全失效：控制队列的消费端原来挂在面板主区（`P3Shell`）里，面板不在前台就没人拉取，指令一直积压、等打开面板才一次性补执行。现在消费端随插件生命周期启动，面板开不开都能在 2 秒内生效。
- 只有当前出声的窗口消费指令（多窗口时靠播放器领导者判定），避免指令被取走却播不出声。
- 队列里的指令超过 5 分钟直接丢弃，后台标签页被节流/冻结后唤醒不会重放很久以前的「播放某歌」。
- 本地曲库按需加载：面板没打开时也能按歌名播放本地歌曲，不再因为曲库为空而静默失败。
- `music_control` 的工具说明改为「由播放器执行，音乐面板无需打开」。

### 曲库

- 单曲右键菜单新增「详细信息」：本地文件一屏显示路径、格式、文件大小、码率、采样率、时长、修改时间、加入曲库时间与播放次数；路径可直接点击在文件夹中定位，也能复制。
- 在线曲的同一个面板显示平台、歌曲 ID、音质与缓存占用；没有缓存时直接说明「未缓存」，不再把在线曲的文件大小读成 0。

### 在线播放失败

- 修复 issue #26 的一类失败：平台把地址签给某一个 CDN 节点，节点拒绝取流（403）时，路由现在会重新要一次签名地址（通常落到另一个节点），仍失败再降一档音质，最后把「CDN 节点拒绝了取流请求（HTTP 403）」这类原因带回客户端。
- 客户端不再把代理返回的错误页交给媒体元素：非 2xx 时先读出 `error.message` 说明原因并停下，不再降级直连同一地址（此前 toast 显示的是 Chromium 的 `DEMUXER_ERROR_COULD_NOT_OPEN`）。
- 浏览器内核文案（`PipelineStatus::…`、`MEDIA_ERR_*`）只进日志，界面改用一句可读的话；在线曲没有具体原因时也不再误报「已跳到下一首」。

### 在线云盘

- 修复酷狗云盘永远显示「空」：`user_cloud` 补上登录会话（`token` + 设备 cookie）。此前只传 `userid`，包用空 token 签名，上游回 `error_code 20010`，列表被读成空。
- 云盘行按平台真实形状归一：`hash` 作为 id、带 `album_info` 的扁平行不再被当成嵌套包行、标题去掉 `.mp3`/`.flac` 等容器后缀，37 首云盘歌曲的标题/歌手/专辑/时长与客户端一致。
- 上游拒绝不再伪装成空盘：拿到 `error_code` 时直接报错（路由回 502 并带原因）；未登录时不发请求、直接空列表。
- 「云盘为空」空态按登录态区分：已登录时说明「这个账号的云盘里还没有歌曲」，不再让已登录用户以为要重新登录（网易云与 QQ 的 `count: 0` 是账号里真的没文件）。

## 0.40.0 — 2026-11-21

### 歌词

- 歌词匹配新增“写入文件标签”：本地 MP3 写 ID3 USLT，FLAC 写 Vorbis `LYRICS`；逐字歌词先由 Folia 的 `serializeEnhancedLrc` 转成增强型 LRC，再随标签写入，播放时由本地原始文本解析器恢复逐字时轴。写入前保留 `.lyrics.bak`，成功后把歌词来源切到 `embedded`。

### 元数据编辑器

- 按 DSH 主题与组件规范彻底重做编辑元数据：顶部封面/标题/格式/在线歌词 hero；下面左侧基本信息与制作信息、右侧歌词卡片的双栏工作区（`.mp-meta-work`），`KitModal` + `KitInput` + 0.5px 分隔线 + token 化歌词输入，窄屏自动折叠为单列。
- 移除未渲染的 metadata match 代码和 CSS；左上角“在线匹配”实际打开歌词匹配且与歌词区按钮重复，改为唯一的“在线歌词”入口，不再用不存在的元数据匹配冒充。

### 智能平衡

- 智能平衡改用 Folia 音频 bundle 的 `chooseBalance` / `planBalanceMove` / `whyNotWholePlay` 作为权威规则（无 bundle 时保留纯 JS 回退），补齐 `profile` / `head` / `platform` 输入顺序、`blendAudible` 的 hold 和整曲 clip/lead-in 判定。
- 响度记录改为 `file` / `played` 两份 `loudness + peak`，典型增益按歌曲去重；文件分析改在 22.05kHz、用 Folia 的 K-weighting 与 gated loudness，缓存测量值而不是最终 gain。
- ReplayGain 标签的 `trackPeak` / `albumPeak` 现在从文件标签读取并传到平衡输入，避免有正向标签增益时因缺少 peak 被错误限制为 0 dB。
- 新增 `volume-balance-parity.test.mjs`，逐项比对本地回退规则与 Folia 音频 bundle 的 `chooseBalance` / `planBalanceMove` / `whyNotWholePlay`。

### 在线增益

- 网易云 `getDownloadURL` 保留平台返回的 `gain`，酷狗标准版/概念版保留 `volume` / `volume_peak`，并统一通过 `/online/stream` 的 `x-music-*-gain/peak` 响应头交给播放器。
- 客户端把该增益作为 `platformDb` 送入智能平衡；切歌时清空，平台没有真实增益时不伪造。
- 新增 `music.profile.v1`：把当前曲已解码音频测出的 `programLoudness + peak + leadIn` 作为 profile 输入；整曲判定使用 leadIn。

> profile 会对当前曲整曲测量，并为下一首本地曲预分析；Navidrome 使用 Range 读取头部 1.5MB，解码成功时写入 partial head。`head` 在 Folia 里只用于头部估算，不伪造。
- 媒体缓存的元数据现在保存 `replayGain`，缓存命中时重新发出 `x-music-*-gain/peak` 响应头，在线增益不再因缓存重播丢失。
- 引入 Folia `trackProfile` 的完整纯分析 bundle（`scripts/build-profile.mjs`）：当前曲/下一首本地曲和 Navidrome 头部会生成 tempo、key、leadIn、sections、programLoudness、peak 等 profile；平衡继续只读 programLoudness/peak/head/leadIn。
- profile 分析优先在 Blob Web Worker 中运行，Worker 创建或运行失败时回退主线程；`npm run check` 现在同时校验 profile bundle 是否最新。
- 接入 Folia `gridFromBeats` 的纯转换：有 Beat This 拍点时可以生成 bpm/outroBpm/beatOffset/downbeatOffset/beatsPerBar；模型推理本身仍不在本插件内。
- profile 记录带 `TRACK_PROFILE_VERSION`，版本不匹配的旧 profile 会被忽略；在线下一首只有在跨淡预取已经拿到 blob 时才分析，不额外下载。
- 交叉淡入的 `planBlendShape` 现在读下一首 profile 的 bpm/beatOffset，把 overlap 吸附到拍点；没有 profile 时保持原有 envelope 计划。
- `/online/cache-info` 现在给下一首在线曲提供缓存命中信息；已缓存的在线下一首可直接用 Host 缓存分析 profile，不额外访问 CDN。
- crossfade 的尾部/开头估算在没有 envelope 时回退到 profile 的 `bodyOut` / `leadIn`。
- profile 预分析带当前队列 token；切歌后旧分析即使完成也不再写入 profile。
- crossfade 按 Folia 的 outroKey/introKey 关系缩放 overlap：clashing 0.4、neutral 0.7、adjacent 0.85、compatible/unknown 1。
- crossfade 接入 Folia `chooseTransitionStyle` / `shapeBlend`：按 key、tempo、endsHot、startsHot、outroSlope 选择 beatCut / bassSwap / tailRide / plainBlend，并把 `hold` / `together` / `crossover` 真正传给 transport；style 的 `lengthScale` 现在会缩放 overlap。
- automix profile 分析不再依赖“音量平衡”开关：关闭智能平衡时仍会分析当前曲/下一首，但播放不会等待它。

### 在线播放启动

- 修复 MSE 远距离 seek 等待缓冲时底栏提前切成暂停图标：播放状态只在媒体真正 `playing` 后置为 true，`play` 请求不再冒充可听播放；pending seek 立即回到暂停态。

- Host 现在把 CDN 的 `application/octet-stream` 等泛类型按 URL/音质归一为 `audio/mpeg` / `audio/flac` / `audio/mp4`，避免 MSE 因 MIME 不支持而静默回退直连。


- 修复 MSE 总时长只反映“已 append 的前缀”导致拖动比例映射错误：seek bar/时间显示优先使用歌曲已知时长，`MediaSource.duration` 在 sourceopen 时设为整首时长，`api.seek` 不再把目标 clamp 到当前 MSE 前缀。


- 在线当前曲改用 MediaSource：Host 字节流按块 append，客户端自己维护 buffered ranges 和 seek，不再依赖 `<audio src>` 对代理 Range 的判断；MP3/AAC/M4A 走 MSE，不支持 MSE 的格式才回退直连。
- MSE 的首音只等第一块数据 append；目标未缓冲时 seek 保留 pendingSeek，不把 currentTime 写回 0。
- Host 继续固定同一首歌/音质的已解析 CDN URL，并对 Range 返回 200 的 CDN 强制转成 206 + Content-Range，作为直连回退路径的兜底。

### 代码结构

- 修复开发安装：desktop profile 原先锁 `0.38.0`，DSH 重启时 pnpm 会用 store 覆盖 `install-local` 的副本；开发期改用 `link:`，并让 `install-local` 在检测到 junction 时拒绝执行，避免反向删除工作区。

- 在线播放收敛为一条链路：`prepareOnlineElement` 统一停旧源，`startOnlineDirect` 统一直连回退与平台增益，MSE 只负责字节流/缓冲/seek；所有 seek UI 共用 `effectivePlayerDuration`，不再各自算 `max(media, track)`。

- `now-playing.js` 按职责拆到 `src/client/components/ui/now-playing/`：`index.js` 只保留页面编排与状态，`capsule.js`、`transport-pill.js`、`seek-bar.js`、`settings-panel.js`、`secondary-actions.js`、`sleep-menu.js`、`editor.js`、`lyrics-scroll.js`、`lyrics-timing.js`、`cover-accent.js`、`fullscreen.js` 各自承担一个组件或 hook；不再把所有功能塞进一个 3200 行文件。

### 清理

- 删除已不再挂载的旧播放页外壳 `src/client/components/ui/player-page.js`、它的测试和 `.mp-page-*` 样式；当前全屏播放页由 `NowPlaying` 渲染，旧壳只会在构建产物里留下死代码。

### 播放底栏

- 播放页实际使用的 `NowPlayingCapsule` 按 Folia 的 transport 语义对齐：标题、传输键、当前时间、进度、总时长、循环模式与队列保持在同一胶囊；循环键支持 Folia 的「不循环 / 列表循环 / 单曲循环」三态，直接调用 `player.setLoop`，不再借用会同时改随机顺序的播放模式循环。进度仍走同一个 `SeekBar` / `player.seek`。
- 胶囊外观改用 DSH 语义 token（浮层背景、描边、主按钮、三级文字、阴影派生），不再使用写死的 `rgba`/白色按钮。
- 播放页顶部「返回」与「全屏」加入同一套自动淡出：和胶囊、右下角手柄一起 3 秒无操作后向各自边缘退 8px 并淡出、不再拦截点击，鼠标移动 / 点击 / 按键立即回来。键盘把焦点移进去时保持可见（`:has(:focus-visible)`），但不被鼠标点击留下的焦点钉住——否则点「全屏」后按钮一直聚焦，自动隐藏就永远不会发生。

### 播放卡片

- 「本地」来源页按 Folia 的 SourceTab 语义对齐：标签随歌曲类型变为「本地 / 歌词 / Navidrome」；在线歌曲不再显示「没有本地文件」和本地文件信息，本地歌曲只显示文件名与大小/码率，Navidrome 显示 Song ID。
- 歌词来源行改为 Folia 的本地 / 内嵌 / 在线 / 导入语义；纯音乐只作为无歌词时的状态标签，不再是可选来源；时间轴偏移支持直接输入并按 250ms 步进，翻译开关和歌词分词不再重复出现在来源页。

### 在线喜欢

- 修复在线歌曲红心不亮：`likeStateOf` 读的是 `onlineStore.liked[track.path]`，但启动时从未调用 `/online/liked-ids`，这份 map 一直是空对象；现在 `loadProviders()` 会在已登录来源加载后按 provider 合并喜欢集合，并按 `online:<provider>:<id>` 归一化。
- 酷狗概念版支持写入「我喜欢」：通过 cloudlist 的 `playlist_tracks_add` / `playlist_tracks_del` 操作内置收藏歌单；取消时按 hash 在当前收藏歌单中解析 `fileid`，不会误删其他歌单中的同名行。
- 波点音乐补齐 `likes` / `likeWrite`：读取 `liked_songs`，写入 `like_song`，与 Folia 的 `getLikedSongIds` / `likeSong` 行为一致。
- 在线平台喜欢能力现在为：网易云、QQ、酷狗概念版、波点、汽水、Navidrome 均可读写（具体平台仍取决于登录态与上游授权）。
- 酷狗概念版与波点补齐「收藏到歌单」：概念版按歌单 `listid` 写入 cloudlist，波点读取账号歌单并调用 `playlist_tracks_add`；播放器卡片的在线收藏对话框现在能列出目标歌单并完成添加。

### 在线歌单

- 网易云歌单不再停在 1000 首：Host 以前只请求一次 `/playlist/track/all` 的 `limit:1000, offset:0`；现在按 500 首分页，循环到歌单 `trackCount` 或返回不足一页为止，与 Folia 的 `getPlaylistTracks(limit, offset)` 分页一致。
- 在线歌单接口新增 `limit/offset` 分页：网易云、波点、汽水、酷狗/概念版、QQ、Navidrome 返回 `songs/hasMore/nextOffset/trackCount`；客户端首屏只取 100 首，滚动到底再取下一页，不再把整张歌单放进一个请求。
- 同类分页上限一并排查：波点原来只取 100 首，汽水只取 60 首，酷狗标准版只取 300 首，酷狗概念版停在 2000/4000 首；现在分别按 `total` / `hasMore` / 短页继续取。QQ 自建歌单与「我喜欢」本来已分页，Navidrome 和本地歌单不设固定上限。
- 「添加到歌单」弹窗改为 DSH 组件体系：`SetRow` 分组行 + `Button`，使用 `mp-set-card` / `mp-folder-state` / `mp-online-error` 等现有样式；移除裸 `<button>`、内联边框/背景/圆角与硬编码错误色。

## 0.39.2 — 2026-11-20

### 播放时钟

- Folia 歌词舞台的共享时钟改用播放器当前 active deck 的 `getPlaybackTime()`，不再 `querySelector` 第一个 `audio.mp-audio-host`；交叉淡入淡出切换到 B deck 后，回环等所有歌词样式不会再冻结在每句第一个字。音频带也按 active deck 判断是否在播放。
- Folia 当前歌词行不再使用父层约 4Hz 的 `timeupdate` 索引，而是在舞台内部用同一 `clock` 按 Folia 的 `findLatestActiveLineIndex` 逐帧计算；逐词动画和行切换现在共用一份时间真值。

### 在线播放

- 修复酷狗部分旧单曲的 CDN 404：现代 `/song/url` 返回的地址可能已失效，而 hash 仍存在。现在在 CDN 404 时先走酷狗旧版 `getSongInfo.php?cmd=playInfo` 取当前地址，取到才重试；取不到仍按原质量降级流程处理，与 Folia 的 legacy fallback 一致。

### 在线与账号

- 在线来源卡片统一为同一最小高度；Navidrome 连接表单默认收起为紧凑卡片，展开后独占整行，不再把同行的酷狗卡片撑高。
- 汽水音乐等超长账号 ID 改为单行省略，并保留完整 ID 的悬浮提示。
- 在线账号卡片改为内容驱动高度并上下均衡分布；Navidrome 收起态使用单行说明 + 固定宽度的连接按钮，按钮文字不再被挤成竖排。
- 底部字幕改用 Folia 的 112px 几何（32px 基线 + 80px 净空），不再使用宿主适配层的固定 64px。
- 左上角来源按钮的本地音乐图标改为与菜单一致的硬盘图标。

### Folia 样式

- 花火/绘光的竖排布局差异不是样式代码写错：本地 44 个 Hanabi 文件和 63 个 Lumiere 文件与 Folia 上游逐字节一致。差异在 seed：Folia 用 `displaySong.id` 作为 `visualizerGeometrySeed`，我们之前传完整 `trackPath`（在线歌曲是 `online:provider:id`），导致同一首歌的确定性随机分支不同；现在改用在线 `onlineId`、本地 `id/path` 作为 seed，布局分支与 Folia 一致。

- `VisualizerShell` 补上 Folia 页面由 Tailwind preflight 提供的默认 `line-height: 1.5`：此前宿主页面的行高更紧，Monet 歌手名被 `truncate` 的 `overflow:hidden` 上下裁切。Monet 源码本身与 Folia 一致，差异在宿主 shell 的全局排版上下文。
- 13 个歌词样式的源码目录与 Folia 上游逐文件一致；`FOLIA_STYLE_META` 的排序改为各 `entry.tsx` 的 `order`（sonnet 10 … still 130），`VisualizerShell` 同时恢复 Folia 的 flex 居中布局。

### 来源菜单

- 左上角来源菜单不再出现两个「本地音乐」：`/online/providers` 只返回在线来源，客户端同时防御性跳过 `local`。
- 来源菜单首次打开不再从只有本地逐项长到完整列表：在 `/online/providers` 加载期间先渲染已知平台的禁用占位项（显示「加载中」），元数据到达后原位替换；本地音乐改用硬盘图标。

### 歌词时间轴

- 修复旧歌词 override 丢失词轴的问题：记录标记为 `wordLevel` 但 payload 只有 LRC 时，`/online/lyric` 会用同一来源重新取一次并修复 payload；酷狗 KRC、QQ QRC 等逐词歌词不再退化成估算词轴，云阶 / 心象也能恢复渲染。

### 在线歌单

- QQ 歌单读取按 Folia 的分页模型补齐：自建歌单每页 100 首，持续按 offset 读取到 total / 空页 / 重复页为止，不再一次请求 `limit=1000` 后被上游截成前 100 首。
- 对齐 Folia 区分自建与收藏歌单：收藏歌单走匿名完整路径，避免带凭据的自建路由少歌；匿名/公开歌单保持完整。

## 0.39.1 — 2026-11-19

### 播放

- 音量设置持久化：播放引擎创建时从 `prefs.volume` 恢复上次音量，重启 DSH 后不再回到 100%；异常值归一到 0–1。

## 0.39.0 — 2026-11-19

### 歌词样式

- 行级歌词（没有 `line.words` 的 LRC / 在线回退）在 legacy → Folia 边界按 Folia 的 `buildTimedWords` 合成逐词时间轴；云阶（partita）和心象（cadenza）不再因英文行级歌词空白，其他词布局样式也不会再收到空 words。

### 在线播放修复

- 修复 0.38.0 酷狗概念版 `high` / `lossless` 取流 404：半套 `album_id` 不再触发 metadata 请求，嵌套 package 行保留精确 `album_audio_id`；标准路径按 Folia 的请求档位与主 hash 取流，不再固定从 `flac`/`hqHash` 开始。
- Host 在已解析地址仍返回 404 时按 Folia 音质阶梯降档重试（high → standard、lossless → high → standard），避免整首 502。
- QQ 音质请求改为 Folia 的 API token 阶梯（128 / 320 / flac），高档无 URL 时自动降档；标准档仍无地址才请求试听。

### 列表密度

- 歌曲列表行高从 84px 调整为 76px（84 × 90%，取整保证虚拟列表整像素定位）；封面、标题、副标题、专辑、时长、操作按钮、列宽、间距与图标同步缩放到约 90%，CSS 行高与 JS `rowHeight` 同步更新。

### 音频焦点

- 按 Folia 的 `voiceInputPause.cjs` 移植 Windows 麦克风占用检测：注册表轮询、2 次确认开始 / 3 次确认停止、暂停后只恢复由语音输入造成的暂停；默认关闭，仅 Windows。
- 新增 TTS / 语音预览避让：`window.__dshMusicAudioFocus` 同窗口 API 与 `/music/audio-focus/duck` Host 路由，支持 reason、剩余音量、渐变时间和 TTL；多个 reason 取最低音量。
- 播放器 master gain 增加独立 duck 因子与可调 ramp，不修改保存音量；设置 → 播放 → 音频焦点提供开关、避让后音量与渐变时间。
- Host 路由 `/music/audio-focus/status`、`/config`、`/duck`；Host 服务在插件卸载时停止轮询。

## 0.38.0 — 2026-11-19

### 主面板替换（panel-v3）

- 用新的 panel-v3 壳替换旧主面板：顶栏 / 视图栏 / 内容 / 播放条 / 队列浮窗全部重写，旧 `panel.js`、`navigation.js`、`header.js`、`local.js`、`online.js`、`player-bar.js`、`track-row.js` 删除。
- 新浏览结构：歌曲、专辑、歌手、文件夹、喜欢、歌单、统计；本地专辑 / 歌手 / 歌单详情；在线最近、歌单、专辑、歌手；统一搜索页。
- 交互：单击选中、双击播放、悬停播放、选择操作条、右键菜单、队列浮窗；来源菜单改为运行时 `/online/providers`，不再写死平台。
- 保留播放页、设置页、歌词、播放队列/播放卡、侧栏和输入框控制；旧 `music.ui.v2` / `music.ui.v3` 路由迁移到 `music.ui.v4`。
- 新增 panel-v3 渲染测试、主题守卫覆盖；`npm test` / `npm run check` 通过。
- 队列补逐行移除、拖拽排序、外部点击关闭；在线搜索补“加载更多”；在线专辑/歌手/歌单/搜索错误补页内重试。
- 本地专辑/歌手/文件夹/歌曲列表加缓存，减少大曲库重复分组/排序；新面板不再写旧 `music.ui.v2`，只保留一次性迁移读取。
- 歌单管理改为正式 `KitModal` 弹窗（新建/重命名/删除）；Navidrome 歌曲页补分页加载；来源/账号/排序/选择菜单补键盘焦点与方向键/Home/End/Esc。
- 在线搜索对齐 Folia 的 collection 能力：Host 新增 `searchAlbums`/`searchPlaylists` 契约与 `/online/search?kind=`；客户端统一搜索结果为“最匹配歌手 → 专辑横向行 → 歌曲列表”，不再使用单曲/专辑/歌单互斥页签；专辑栏目只在平台支持时显示，歌单搜索不进入主搜索页。
- 在线浏览 Tab 改用 `browseAlbums`/`browseArtists` 能力位：只有本地与 Navidrome 有完整专辑/歌手目录，网易云/QQ/酷狗等不再显示空白的专辑/歌手 Tab。
- 删掉旧 `VirtualList` 死模块及其 CSS；补窄屏 620/520 断点。
- 搜索交互改为“聚焦不跳页、第一次输入才进入搜索页”；搜索页隐藏资料库主导航标签，避免点搜索框就清空当前列表；删除整个搜索词会直接退出搜索，不再留下空白面板；返回按钮改为带“返回”文字，不再只有左上角小箭头。搜索空页/无结果页的中心空态补“返回”按钮，方便快速回到资料库。
- 顶栏把平台切换与账号头像合并为一个控件：账号头像 + 平台角标 + 平台名；未登录显示平台图标，菜单同时列出账号操作和各平台图标。账号头像遵循 Folia 的 AccountPicture 做法（头像缺省用昵称首字，HTTP 头像在 HTTPS 页面升级）。登录账号为 VIP 时在平台名旁显示 VIP 徽章和有效期。
- 歌曲行内的多位歌手改为各自独立的链接，悬停只给当前歌手加下划线，点击也打开对应歌手；酷狗搜索补 `pay_type` 的 VIP 判定，并修复嵌套专辑对象显示成 `[object Object]`。
- 导航按 Folia 拆成 browse / search / collection 三层：搜索是独立 overlay，专辑/歌手/歌单详情是 `{origin, stack}` 集合栈；详情页每次都能返回搜索或资料库来源，Tab 只表示资料库分区，不再把详情映射成父级 Tab。`music.ui.v4` 保存完整导航快照，详情栈重复/往返会折叠。
- 在线来源默认打开歌单，歌单 Tab 排在最近播放之前；旧会话里保存的最近播放会迁移为歌单。
- 在线专辑/歌手封面按 `provider + kind + id` 写入媒体缓存，歌单封面不再依赖会变化的远程 URL；歌单、专辑、歌手列表重开时命中本地缓存。
- 搜索对齐 Folia：网易云专辑/歌单搜索改走 `/cloudsearch` 的 type 10 / 1000；QQ、酷狗补上专辑搜索；专辑请求与歌曲搜索共用 250ms 防抖并加 5 分钟结果缓存，减少逐键请求和重复搜索延迟。
- 搜索后端继续对齐 Folia：QQ 歌单搜索改走 `/search type=playlist`，酷狗改走 package `search type=special`，汽水补 `search_playlists`；搜索页仍不显示歌单栏目。
- 酷狗取流身份对齐 Folia：`albumAudioId` 只取精确的 `album_audio_id` / `albumAudioId`，概念版不再把 `mixsongid` 当专辑音频 ID；package 每档先按 metadata 请求，再按 hash-only 回落，网关与 v6 兜底保持 hash-only。
- 在线能力补齐：新增「推荐」与「云盘」Tab；推荐页显示每日推荐、推荐歌单，并提供私人 FM 播放入口；云盘页支持网易云/QQ/酷狗（含概念版）云盘列表与取流；登录账号可订阅/取消订阅歌单与专辑，自建歌单可从行内移除歌曲。
- 歌词对齐：来源 id 兼容旧 `kugou` 并映射到 `kugouLite`；默认首选来源改为 QQ；搜索查询改为 Folia 的 `title - artist - album`，酷狗歌词搜索用标题；自动匹配不再排除歌曲自身平台。
- 歌词匹配窗口按 Folia 重做：来源顺序改为 netease / AMLL / qq / kugouLite / qishui（共享歌词来源表，去掉不是歌词源的波点），打开即用 title - artist - album 搜索；在线歌曲自动选中首条、Navidrome 优先同名；AMLL 候选保留 ncm/qq 平台并禁用其封面/元数据；结果列表补时长匹配标签；本地文件补“不使用在线匹配”和“纯音乐”按钮；界面改用 KitModal / KitInput / Button / Switch / Tabs / Tag 与 DSH token。
- 歌词匹配仍缺 Folia 的三项能力：Spotify / Apple Music 来源（本插件没有这两个 provider）、Navidrome 的“服务器歌词/在线歌词”二选一，以及 QQ 专用歌词搜索（当前走 omni 曲库搜索）。

- 设置页外观的歌词样式改为真实界面缩略图：14 张截图按样式 id 压缩为 480px WebP（合计约 107 KiB），由插件本地 `/music/assets/lyric-style-thumbs/` 提供，随机样式保留图标。
- 设置页重做：外观增加 Folia 歌词样式/背景/动态/主题来源；播放增加在线音质与 1–25 秒过渡上限；恢复增益补默认值；Host Kit 状态与组件测试归入「关于与诊断」；缓存显示歌词大小；许可证修正为 AGPL-3.0-only。
- 删除无消费方的旧配置 `bgBlend`、`composerLyricPlace`、`lyricKeepProviderWordTiming` 及其文案；修正 `lyricAlign`/`lyricGap` 默认值不一致。
- 移除已失效的「播放页封面样式」：设置行、播放页编辑器封面区、首次启动引导的封面选择、相关 prefs/CSS 文案全部删除；同时移除有问题的「播放页透明背景」设置与播放条开关。
- 智能过渡对齐 Folia 的 plain crossfade：1–25 秒上限、等功率、按曲目剩余空间/静音边/曲目四分之一限制重叠；设置页提供上限滑杆。Folia Automix（节拍/分轨）引擎未移植，当前只实现 crossfade 模式。
- 酷狗/酷狗概念版取流只按 hash，不再把可能错配的 album_id/album_audio_id 交给播放地址接口，修复点 A 播 B。
- 清理旧面板已不再引用的基础 CSS 选择器（顶栏、侧栏、旧行/网格/入口等）与旧媒体查询，保留设置页/播放页共用的样式。

## 0.37.2 — 2026-11-18

### 文档准确性

- README 的平台清单补全波点 / 汽水；Navidrome 的凭据路径改为当前的 `sessions.json`。
- 在线缓存说明改为当前行为：默认关闭、整首播完才写入、默认 5 GB、入口是「设置 → 数据」；删除「边播边写 / 10 GB / 设置 → 缓存列表」等旧描述。
- 删除「汽水服务端不可达、不会出现在平台列表」的过时限制，改为说明汽水已接入、二维码需用抖音 App 授权；同步修正英文版。

## 0.37.1 — 2026-11-18

### 文档与插件市场

- README 的截图全部换成真实界面：本地曲库、播放页（黑胶与逐行歌词）、队列、播放统计、纯音乐、Folia 的三种歌词舞台；此前指向不存在的 `docs/screenshots` 的失效图片一并移除，图标改从 `main` 读取。
- 插件市场描述更新为当前功能与入口说明；新增 `docs/使用详情-英文.md` / `docs/使用详情.md` 与 `docs/preview.svg`，插件详情页显示一张播放页图片。

## 0.37.0 — 2026-11-18

### 设置页

- 修复设置页切到「歌词」或「数据」后整页空白：这两个标签调用的 `mpSmallButton` / `mpSegment` 原本只定义在 `player-sheet` 组件内部，离开那个组件就是未定义引用，渲染直接抛错。两个小控件抽到 `primitives.js` 共享，并为全部设置标签加了渲染回归测试。

### 登录（按 Folia 归位）与平台头像

- Navidrome 回到「设置 → 在线」作为唯一表单，和 Folia 把服务器连接放在「连接与集成」一致：登录窗口只保留扫码平台；顶栏「连接」、「启用完整曲库」、会话过期后的重登录都打开设置 → 在线；独立 `navidrome-dialog.js` 和登录窗口里的 Navidrome 分支删除。
- 设置里的 Navidrome 表单补上「保存密码，启用完整曲库」开关，`connect()` 发送 `storePassword`（此前只有被删的独立对话框有，设置页没有）。
- 登录窗口的平台图标在账号已登录且取到头像时直接显示头像，不再只显示平台 logo。
- 修复头像读取：QQ 会话没有 cookie uin 时用 `session.userid` 生成 qlogo 头像；酷狗 Lite 的 verify 接口常返回空资料，回退到同一账号的酷狗完整会话；波点的 `login_status` 返回用户对象本身，插件原来只读 `.user` 导致刷新时拿不到昵称/头像；账号读取不再用空字段覆盖已存资料。

### 在线歌曲的「在线匹配」

- 播放在线歌曲时点「在线匹配」不再无反应：以前按钮写死为仅本地文件（`!track.onlineProvider` 才打开），现在与 Folia 的 `OnlineSongLyricMatch` 对齐——在线歌曲同样打开匹配窗，只匹配歌词，选中后写到该曲的歌词记录（`online:<provider>:<id>`），不触碰文件标签；本地文件仍保留「元数据 / 封面 / 停止自动匹配」开关。
- `/lyrics/match-apply` 支持 `online:` 路径：走歌词记录而不是 `resolveTrack`，并返回 `metadataApplied:false / coverApplied:false`。

### 歌手页（汽水 / 波点）

- 修复汽水歌手页 `Qishui singer has no id`：从历史/队列恢复的歌曲可能只剩歌手名，Folia 靠歌曲里的 `catalogRef`，我们改为在 `artistSongs` 里按名字走一次本平台搜索解析出 `artistId`；播放快照也会保留 `artistsDetail`，从播放栏进歌手页同样可用。
- 波点歌手页的专辑卡片没有封面：卡片读的是 `cover` 字段，而 `artist_albums` 只给了 `coverUrl`；现在两者都带，并且 `artist_detail` 提供艺术家头像/简介头部。
- 波点歌曲行的 VIP 标按 `payInfo.feeType.vip` 恢复（平台自己的会员标记，与其它平台徽标一致）。
- 专辑/歌手卡片封面代理带上 `provider`，按平台使用各自的 Referer。

### 在线封面与播放 URL

- 修复汽水/波点「列表无封面、点播报 Failed to load because no supported source」：原生源的歌曲行只有 `sourceRef`、没有 `provider`，客户端 `onlineTrackOf` 取到 `undefined`，于是封面代理和取流 URL 都变成 `provider=undefined`。两个源的行现在带 `provider`，`onlineTrackOf` 也回退到 `sourceRef.sourceId`。
- 汽水封面按 Folia 的 `qishuiImage` 追加抖音图床的 `~<template_prefix>-image.image` 后缀；不带后缀的裸 `/img/<uri>` 会被 CDN 400。
- 在线取流失败时不再把同一个失败 URL 当媒体源重试，而是解析 Host 的错误体并把平台原因显示出来；播放器停在这首，不再刷「no supported source」。

### 崩溃与遗留引用

- 修复「退出登录把 DSH 带崩」：`/online/logout` 对所有平台无条件调 `omni.forgetTokens`，波点原生源没有该方法，抛出的 `unavailable` 从未捕获路径逃出导致 Host 退出；波点补 `forgetTokens`/`logout` 清 session，退出清理改 best-effort，路由兜底再保护已关闭的响应。
- 清理缓存对齐的残留：`panel.js` 仍在每 3 秒轮询已删除的 `refreshCacheStatus`，renderer 报 `Uncaught ReferenceError`；删除该轮询。
- 歌手页透传 `artistsDetail`（`onlineTrackOf`），波点/汽水的歌手页才能拿到 `artistId` 打开，而不是只剩歌手名。

### 波点专辑 / 歌手页与播放

- 修复波点专辑页「Invalid Bodian pagination」：车机接口单页上限是 100（原先传 500/200 被包直接拒绝），专辑与歌手歌曲改为按 100 分页取完。
- 波点播放补上 `freeSign` 与音质：搜索行里的 `freeSign` 记入 `providerData`（队列恢复时回退 `song_detail` 再取），`/online/audio` 不再因为缺少播放上下文被判「需要额外权限」。
- 波点封面：Kuwo 的 `http://*.kuwo.cn` 图片升级为 https；封面代理按平台使用各自 Referer（波点用 kuwo、汽水用抖音），专辑/歌手页与歌曲行的封面恢复。
- 在线歌曲取流失效时不再自动跳过整队列：播放器停在这首歌并提示失败原因（避免列表和正在播放疯狂切换）。

### 汽水 / 波点的歌曲信息与专辑·歌手页

- 汽水搜索结果补齐歌曲信息：`durationSec`（客户端读秒，之前只有毫秒所以显示 `—:—`）、`albumId`、SVIP 标签（来自 `commerce_info.icon_info` / `playable_condition`，与其他平台的 VIP 标签一致），封面代理允许抖音图床（`douyinpic.com` 等），专辑名/封面恢复显示。
- 汽水歌手页按 Folia 的 `artist_songs` 实现并修正参数（传 `artistId` 而不是歌手名）；汽水的车机接口没有专辑页（Folia 的 `albums: false`），点专辑时提示「该平台不提供专辑页」，不再报错。
- 波点搜索/专辑/歌手页：补上 Folia `bodianCatalog` 的 `album_tracks`、`album_detail`、`artist_songs`、`artist_albums`，并声明 `albums` / `artists` 能力；歌曲补 `durationSec`、`albumId`，专辑与歌手页不再是「does not support」。

### 扫码登录（波点 / 汽水）

- 汽水音乐的登录说明改为「用抖音扫码登录汽水音乐 / 请使用抖音 App 扫码并确认授权」（与 Folia 文案一致）：二维码是抖音开放平台的授权码，用汽水音乐 App 扫只会停在「已扫码」，必须在抖音里确认授权；波点、酷狗也改成具名 App 的提示。
- 修复波点音乐扫码后提示「平台拒绝了这次登录」：波点上游的成功状态是 `confirmed`（包已把 session 写进仓库），插件只认 `success`，把它当成了失败；现在 `confirmed` 按成功处理并取回 session，二维码有效期也从 2 分钟改为包本身的 5 分钟。
- 修复汽水音乐扫码时的「这次登录已经被新的尝试取代」：取消登录原来按平台整体处理，刷新二维码/关窗的取消请求如果晚于新一次开始到达，会把新尝试一起删掉；现在取消按 `key` 归属（客户端带上自己的 key，Host 只释放这次尝试），汽水的 `refused` 也会带出平台原因。

### 在线歌曲的 VIP 标签

- 修复 QQ 音乐搜索结果（以及 QQ 歌单/我喜欢）不显示 VIP 标签：QQ 上游用 `pay.pay_play` 标记会员歌曲，插件只认 `payplay`，两者都认之后 VIP 行会正常打标。

### 在线缓存改为 Folia 的「整首听完才缓存」

- 在线音频不再边播边存：只有整首播完（`ended`、单曲循环的每一遍、交叉淡化淡出的那首）后，由 Host 重新取流并写入缓存；跳过、失败、预览片段都不写。**升级会清空旧的在线缓存**（旧 `cache/online` 一次性删除，避免旧规则留下的半截文件）。
- 新增设置「缓存歌曲」，默认**关闭**（与 Folia 一致；关闭只影响写入，已有缓存照常播放）；上限默认 5 GB，可选 1/2/5/10/20/50 GB 或 0=不限，写入后按「最近播放」淘汰。
- 写入校验与 Folia 对齐：预览标记不写、非音频/过小响应不写、下载时长不足歌曲一半不写、覆盖已有副本必须证明 ≥90% 时长；播放解码失败会把该歌标记为不可信并绕过缓存，直到新副本写入。
- 读缓存优先：命中时刷新「最近播放」时间；请求的档位与缓存档位不一致时不使用缓存；平台拿不到 URL 时回退播放另一档的副本。
- 封面改为随整首播放缓存（按歌），`/online/cover` 先返回按歌的缓存，未命中再按 URL 代理；删除按 URL 的封面资产缓存。
- 删除我们自己的缓存 UI 与接口：在线列表的「已缓存/进度」徽标、缓存子页与歌曲列表、单删、「数据」页的旧缓存块，以及 `/online/cache/{list,remove,meta,status}`。存储页现在是：开关、上限、已缓存歌曲数与体积、音频/封面/歌词分类清空。
- 缓存目录固定为 `<DSH_HOME>/music/cache`（`audio/`、`cover/`、`version.json`）。
- 在线歌词改为按歌缓存：平台返回的解析结果（含逐字信息）、auto-match 覆盖和纯音乐判定都写进每首歌的歌词记录（Folia 的 `lyric_<key>` + `OnlineLyricsState`），播放开始先读记录；`/online/lyric` 不再在请求内跨来源搜索，升级结果通过 `best-lyric?persist=1` 落盘，下一次播放直接读记录。
- 歌词预取与 Folia 的轻资源窗口一致：切歌后预取队列后 2 首 + 前 1 首的在线歌词，队列切换时歌词通常已在本地。

### 歌词获取与 Folia 对齐

- 每首歌有了一条歌词记录（`lyric-states.json` + `lyrics/`）：显式来源、匹配到的在线歌词、纯音乐标记都按歌保存，播放时按 Folia 的规则选源。本地文件键为绝对路径，在线歌键为 `online:<provider>:<id>`。
- 本地歌曲播放时按 Folia 的顺序决定显示哪份歌词：显式选择 → 纯音乐 → 在线优先级 → 同目录 → 内嵌 → 已匹配的在线歌词；没有本地歌词（或选了在线优先）时自动跑一次多来源匹配并写回记录，之后不再重复搜索。
- 播放页「来源」一行改为每首可选：本地 / 内嵌 / 在线 / 纯音乐，并可恢复自动；旧的全局「歌词顺序」设置是死值（每次读都被覆盖），已删除。
- 新增两个设置：本地歌曲歌词优先级（本地 / 在线）、首选歌词来源（默认 QQ），自动匹配与借用歌词都按它先问。
- 在线歌曲：来源顺序改为首选来源优先；升级搜索不再以「合成词数」判断逐字（普通网易云 LRC 以前因此从不升级），并接受另一个来源的逐行匹配（同 Folia）；导入歌词与纯音乐判定可按歌保存。
- 歌词来源表与 Folia 一致：`netease → amll → qq → kugouLite → qishui`，来源 id 使用 provider id（修掉酷狗永远被跳过的问题）；Bodian 不再参与跨源匹配。
- AMLL 的候选 id 改为按需取：自身不是网易云/QQ 时先搜一次网易云拿候选 id，且只在匹配走到 AMLL 时才搜。
- 歌词改为一首歌只取一次：`src/client/services/lyrics/loader.js` 按歌去重，播放器与面板共用同一次请求；播放开始等第一份歌词（Folia 的门控，超时 8 秒放行），可选的逐字升级搜索在首份歌词之后由 loader 发起、不挡播放。
- 播放页（歌词舞台）与输入框歌词条也读同一份解析结果：在线歌曲此前在播放页拿不到歌词（`/lyrics` 只接受文件路径），现在按平台自己的、借用到的或导入的歌词显示；升级结果会实时推到这三处。
- 在线歌曲可按歌选择「在线平台歌词 / 导入歌词 / 纯音乐」，导入的歌词保存在歌曲记录里（不再需要写音频文件）。
- 设置新增「同目录歌词优先格式」；旧的全局「歌词顺序」设置已删除。
- 同目录歌词支持 `track.lrc` 与 `track.mp3.lrc` 两种命名，翻译可用不同格式（`.t.vtt` 配 `.lrc`）；内嵌歌词在 `common.lyrics` 为空时回退读取原生标签。
- 新增 `A_other/docs/歌词获取与Folia对齐执行计划.md`，记录决策、契约、数据模型与阶段。
- 匹配歌词窗口按 Folia 补齐：选中的结果可只取歌词、连歌曲信息/封面一起取，也可以选「不再为这首歌自动匹配」；歌词写入歌曲记录，歌曲信息与封面写入文件标签（不支持的容器会保留歌词并提示）。
- 自动匹配支持「换个名字再搜」：首选来源没找到逐字歌词时，用平台知道的另一个歌名（`searchAlias`）重试；完全没结果时，用另一种歌手写法（`alternateArtist`，网易云的歌手 tns/alias）再试一次。
- 同目录歌词格式顺序可在设置里逐项上移/下移，不再只是「优先格式」。

### 歌词与 Folia 样式

- 修复播放页底部歌词后面的硬边深色方块：Folia 编译出的 Tailwind 表依赖它自己的主题变量，插件从未定义（`--spacing`、`--blur-2xl`、`--radius-*`、`--text-*` 等），所有引用它们的工具类整条失效并被排在手写样式之后，字幕的模糊光晕退化成实心矩形。现在按 Tailwind v4 默认值补齐这些变量（`src/folia/folia-css.js`）。
- 字幕背景本身是 Folia 的「字幕背景」设置（默认开）：已接入 `prefs.subtitleOverlayBackground`，设置 → 歌词里可以关掉，pendolo 与其余 Folia 样式都按这个开关渲染。
- 修复歌词还没加载好时屏幕中央显示 `ui.waitingForMusic` 原文：Folia 样式包的 i18n shim 原来是恒等翻译（`t(key) => key`）。现在样式包经 `MP_FOLIA_T` 读插件字典，字典里没有的 key 显示为空；`ui.waitingForMusic` 在 Folia 语言表里本来就是空串，等待首句歌词时不显示占位文字（与 Folia 一致）。

### 界面规范与组件
- 按 DSH 官方文档（`dsh-v0.2.2-rc.3`）重写主题开发指导：先判有无参考界面（有参考时布局/排版与组件类型跟参考、外观跟 DSH），圆角按用途×高度、0.5px 发丝线、层级表面只用 elevation、菜单材质、悬停能力、页面级审查。
- 宿主适配层补齐官方组件：`Button` / `Input` / `Checkbox` / `SegmentedControl` / `SegmentedTabs` / `Tag` / `StateDot`，并新增基于 `Menu` 的 `KitSelect`（DSH 没有 Select）；本地回退按官方样式表几何实现。
- 按钮 28/36（R8/R12）、图标按钮 28、开关 36×20、胶囊 24、设置行 0.5px 分隔线、对话框与设置面板改为只用 elevation 描边；回退对话框补上 Escape（只关最上层）。
- 设置 → 关于 →「测试页面」新增组件测试页：按钮、图标按钮、输入框、下拉、开关、复选、滑杆、胶囊、分段、Tab（md/sm）、菜单、Tooltip、对话框、Toast、状态点、加载、空态与设置行，页头显示宿主组件是 native 还是 fallback。
- 登录面板按钮与页脚（同步 / 退出 / 刷新 / 连接）统一走原语，退出用错误色文字按钮。
- 登录弹窗固定为 440×569：切换平台时二维码、已登录、Navidrome 三种视图不再让窗口跳动；二维码缩到 168、QQ 的扫码方式改成两枚胶囊，内容在固定高度内垂直居中，短视口（≤660 高）自动取消固定高度。
- 设置页按新规范重做：左侧导航带图标、选中态用 business 高亮；下拉全部换成基于 `Menu` 的 `KitSelect`，文本输入换成 `KitInput`，布局/封面的二选一换成 `KitSegmented`，宿主组件状态改为 `KitTag`；设置卡片 R20 + 0.5px 发丝线 + settings-card 材质，行高 44、分区标题与说明统一；正文右侧留出关闭按钮的位置。

- 登录面板彻底重做：440 宽的聚焦卡片，顶部一排平台图标（40px，选中描边 + business 淡底，已登录账号带绿点），下方一列居中内容（标题 → 说明 → 168px 二维码 → 状态行 → 单行扫码提示），底部用发丝线分隔的页脚放「仅保存本机」和刷新/连接/退出操作；取消左侧账号栏、步骤卡、状态胶囊与嵌套卡片。QQ 的 QQ/微信方式切换用两枚胶囊，Navidrome 表单改用 `KitInput`，VIP 改用 `KitTag`；弹窗标题走宿主 Modal（原来空标题导致顶部大片空白），关闭按钮回到右上角。

## 0.36.2 — 2026-11-17

### 安装

- 修复 0.36.0/0.36.1 在 pnpm 默认 `blockExoticSubdeps` 下无法安装：把 `kugoumusicapi`
  的 MIT 源码 vendored 到 `src/host/vendor/kugoumusicapi/`，其运行时依赖改为普通 npm 直接依赖，
  不再使用 GitHub tarball；安装时不需要修改 `pnpm-workspace.yaml`。

## 0.36.1 — 2026-11-17

### 音频播放引擎改为 Folia

- 客户端播放链路整体换成 Folia 的音频子系统：`deck → replayGain → trim → tone → fade → mix → EQ → effects → playback fade → volume → analyser`。旧的插件自建图（preamp、常驻 limiter、单 deck 增益、手写 crossfade 曲线）已删除。
- 新增 `scripts/build-audio.mjs`，把 `A_other/upstream/folia-major-main` 的纯 TS 音频模块编译进 `src/client/audio/engine.bundle.js`；不手写等价 DSP。
- EQ 改为 Folia 的 10 段（首 lowshelf / 末 highshelf / Q=1.4），预设改为 Folia 的 6 个 sound preset，自定义区改为 `custom1` / `custom2` 两个槽。
- 接入 Folia 的 9 个音效滑杆（低切、高切、饱和、位深压缩、走带抖动、黑胶噪声、立体声宽度、空间混响、冲击感）。
- 播放/暂停改用 Folia 的 0.2 s 淡入淡出；设置页新增开关。
- 暂停/播放、seek、音量、静音、输出设备、analyser、Media Session 进度和 `audioSession.type` 都切到新引擎。
- crossfade 改用 Folia 的曲线与 `planBlendShape` crossover；入轨响度目标与正常播放统一为 -14 LUFS；每 deck 的 Folia meter 跟随 active deck。
- 本轮不包含 beat_this / htdemucs 模型与分轨；没有模型时保持普通 crossfade fallback。模型权重约 133MB，按需另议。
- 仍保留插件自己的队列、恢复、统计、在线源、歌词和 DSH Host 适配。

### 登录与在线平台

- 凭据统一写入一个 `sessions.json`；Bodian 不再单独创建第二个 `login/store` 覆盖同一文件，登录后能在设置里显示为已登录。
- 扫码登录补上有效期、关窗取消、已扫码 60 秒超时、瞬时网络失败重试，以及过期尝试的旧轮询结果隔离。
- QQ 登录窗口可以选择 QQ 或微信扫码；登录弹窗不再把 Bodian / 酷狗概念版显示成“酷狗”。
- 平台摘要和登录适配器改为从 source registry 读取，新增平台不再需要改 `/online/providers` 的平台清单。
- 酷狗概念版不再声明未实现的云端喜欢/歌单写入能力。
- 新增 `accounts.json` 账户快照：启动时先显示上次的昵称、头像和歌单；平台读取失败只标记为过期，不清掉已显示的账号。登录、切换、同步和回到窗口时会刷新。
- 登录窗口改为宽版面：左侧平台列、右侧账号/二维码/连接表单；QQ 的 QQ/微信、Navidrome 的连接表单都在同一窗口里，不再单独弹小卡片。
- 新增汽水音乐（Qishui）Host 侧平台：扫码登录、搜索、播放地址、歌词、个人歌单、喜欢读取与写入；凭据只留在 Host 的会话存储里。
- 在线页新增「听歌排行」入口（网易云 / QQ / 酷狗）：最近一周；QQ 的“所有时间”按其年榜显示，不冒充历史总排行。
- 新增可选的「播放上报」（默认关闭）：真实播放满 30 秒后向网易云上报一次；Host 侧限制 5 秒最小间隔与每小时 60 次。
- 登录窗口新增「同步数据」；失败时可重启网易云/QQ/酷狗的本地服务；Host 增加自检与诊断接口。
- 歌手/专辑取数切到 Folia 同款上游路由：QQ 用 `/getSingerHotsong`、`/getSingerAlbum`、`/getAlbumInfo`；酷狗用 `artist_audios`、`artist_albums`、`artist_detail`、`album_detail`、`album_songs`；网易云保持 `/artist/songs`、`/album`；汽水补 `artist_detail`。QQ/酷狗/网易云的歌手页现在能拿歌手信息和专辑列表。
- 从歌曲点歌手现在进入歌手页（头像、简介、专辑列表），可再进「热门歌曲」；歌手页的专辑卡可直接展开专辑曲目。歌手歌曲页的标题和「歌手主页」按钮也能回到歌手页。
- 修复网易云专辑页空白：与 Folia 一样读 `/album` 响应的顶层 `songs`（包的 `album.songs` 现在是空的），不再走额外兜底接口。
- 修复 QQ 歌手专辑空列表：兼容包返回的 `albumMid` / `albumName` / `totalNum` 字段。
- 修复酷狗/酷狗概念版专辑与歌手歌曲：兼容包的嵌套音频结构和 30 条分页；QQ 包请求按 Folia 的 Electron 方式同时携带 `?cookie=`。
- QQ 登录改走包的微信/QQ 通道并持久化 `qqmusic_session`；我的歌单、歌单曲目、喜欢读取改用 `/user/playlist`、`/user/playlist-detail`、`/user/liked-songs`、`/user/song/like`。
- 酷狗已登录时优先走包的 `song_url` 取播放地址，匿名/包失败时保留 gateway 回退；补了包缺失的 `generateWebGLHash` 运行时。
- 酷狗我的歌单/歌单曲目已登录时改走包的 `user_playlist`、`playlist_track_all`，旧 cloudlist 接口保留兜底。
- 酷狗概念版同样优先走包的 `user_playlist`、`playlist_track_all`、`song_url`，旧签名接口保留兜底；酷狗喜欢/歌单写入优先走 `playlist_tracks_add`、`playlist_tracks_del`。
- 对齐 Folia 的会员/试听行为：移除客户端按 VIP 标签的硬拦截；网易云 `freeTrialInfo` 和 QQ `preview=1` 返回的试听片段照常播放并提示，不写入缓存、不计入播放统计。
- 修复 QQ 歌单/专辑曲目标题显示成 `online:qq:...`：兼容 `name`/`songname`/`title` 字段。
- 酷狗曲名去掉重复的「歌手 - 」前缀，与 Folia 一致；前缀和歌手不匹配时保留原名。
- 对齐 Folia 的单酷狗平台：移除标准酷狗平台入口与注册信息，只保留概念版并显示为「酷狗」；旧 `kugou` 会话数据不再暴露。

### 发布撤回

- 0.36.0 撤回（**只撤发布物，代码保留在 main**）：GitHub Release 与 tag `v0.36.0` 已删除，
  npm 上的 `dsh-music-panel@0.36.0` 撤回中。同版本号 24 小时内不能重发，修复后按 **0.36.1** 发布。
- `docs/发布手册.md` 的「回滚」扩成可操作的撤回步骤（GitHub 删 Release/tag、npm unpublish + 把
  latest 指回上一版、Trusted Publishing 不能 unpublish 这个事实）。

### 设置 / 数据

- 设置里的「缓存」升级为「数据」：显示插件数据总占用、文件数和分类明细（设置、收藏、歌单、
  统计、播放状态、账号、缓存、回收站），保留单独的「清空缓存」。
- 新增「清空插件所有数据」：两步确认后清除插件数据目录、内存 store 和插件 localStorage，
  音乐库 roots 置空（安装配置里的 seed roots 不会重新生效），客户端刷新后等同于全新安装。
  用户音乐文件、DSH 会话/设置和其他插件数据不受影响。

### 修复

- 浅色模式下播放页的播放器卡片（封面 / 本地 / 控制 / 播放列表 / 音质）里，圆角块、胶囊、输入框和
  页签变成白底白字：卡片本身是盖在播放页上的深色玻璃，但内部控件读的是宿主 token，浅色主题把它们
  解析成近白表面与深色文字。现在卡片把用到的 `--dsw-*` 钉回深色值（与播放页「始终深色」的既有例外
  一致，覆盖只作用于 `.mp-card` 子树），浅色 / 深色都可读；`test/theme.test.mjs` 加了守卫。

### 界面

- 移除播放页歌词栏上方的「跳到副歌」按钮。它只是把进度跳到平台给出的副歌起点，主流程不需要；
  副歌范围仍作为 `chorusRanges` 进入歌词管线（标记副歌行与配色），不受影响。
- 外观 → 歌词样式新增「随机」：按 `歌曲时长 ÷ 样式数` 把歌切成等长片段，把除「静止」外的样式
  用固定种子洗牌后依次上场；同一首歌重播或拖动进度时顺序不变，暂停冻结，切歌重新洗牌。
  播放页和独立播放页共用同一个解析结果，`mp-style-*` 类与渲染器始终一致。

### 文档

- 新增 [发布手册](A_other/docs/发布手册.md)：版本号与 `client.js` 的联动、tag 与推送、面向用户的 Release 写法、
  npm Trusted Publishing 与 `allow-remote=root` 等已知坑、发布后验证与回滚。也在 README「开发」
  与 AGENTS.md「参考」里链出。
- [主题规范](A_other/docs/主题与组件开发规范.md) 补「深色岛例外」：播放页与播放器卡片始终按深色取值。
- [主题与组件开发规范](A_other/docs/主题与组件开发规范.md) 扩成完整组件手册：DSH 浅/深色机制、token 表与
  fallback 规则、宿主组件适配层（Tooltip / Switch / Pill / Modal / Menu / Toast 及 fallback）、
  12 类组件的结构与可访问性、浅色/深色对照、原生观感基准和验收清单；AGENTS/README 已链出。
- [踩坑记录](A_other/docs/踩坑记录.md) 扩写：新增 19 条（10–28），并把 AGENTS.md「必须知道的坑」整段
  移入本文件；AGENTS 只保留「先查踩坑记录 / 解决后按格式补一条」的指针与规则。

## 0.36.0 — 2026-11-16

### 许可与 Folia 致谢

- 许可证改为 **AGPL-3.0-only**（0.35.0 及更早版本为 MIT，已发布的旧版本不受影响）。本版本包含
  移植自 Folia（`folia-major-main` 0.7.28，AGPL-3.0-only）的渲染器与歌词流水线源码，整体必须保持
  同一许可；`LICENSE`、`package.json`、`README`（中英双语）与 `THIRD_PARTY_NOTICES.md` 已同步。
- README 新增「参考与致谢 / Credits」：说明在线层、歌词管线与可视化参考或移植自
  [Folia](https://github.com/chthollyphile/folia-major)，并给出仓库地址
  <https://github.com/chthollyphile/folia-major>。

### 歌词处理对齐 Folia（本地 + 在线一次打通）

- **本地词级歌词**：Host 的 `/lyrics` 现在把文件自己的文本按 Folia 的 raw 形状交出来
  （LRC / 增强 LRC / TTML / VTT / QRC / YRC / KRC / `.fia`，sidecar 按 Folia 的格式顺序挑，
  `.t.<ext>` 兄弟文件当译文；ID3 SYLT 转成毫秒精度的 LRC + 译文）。客户端用
  `MPFoliaLyrics.parse` 解析，所以本地文件也拿到逐字时间轴、staff 署名策略、副歌标记与
  icu-folia 分词——之前本地只有行级 LRC 的整行均分。
  无时间轴的纯文本仍走 Host 自己的行（原样显示），不会被当成 0 行丢掉。
- **逐字换源**（Folia 的 `autoUseBestLyric`，默认开）：平台自己的歌词没有逐字时间轴时，
  歌词上屏**之后**再问 `/online/best-lyric`，按 Folia 的来源顺序（网易云 → AMLL → QQ → 酷狗，
  逐字优先）检索同一首歌；只有匹配到的确实是逐字歌词才替换并吐一句 toast。有逐字时间轴时
  不再检索（Folia 连已有逐字也会再比一轮；这里换源只可能让对齐/译文变差）。
  设置 → 音乐 → 自动使用最佳歌词。命中与未命中都缓存（未命中 24 小时后重试；连标题都没有的请求
  不算搜索，不写缓存），所以重播不会每次把四个源都搜一遍。AMLL 只对网易云 / QQ 曲目可达（它的库用这两家的 id），酷狗 / Navidrome /
  Bodian 曲目不会问它——Folia 会先搜网易云拿 id，这里没有做。
  未移植：`keepProviderWordTiming`（Folia 里只有 Apple Music 把 `prefersOwnWordByWord` 设为
  true，本插件的平台都没有这个能力）与 AI 分词。
- **借源保留原文**：平台完全没有歌词时借来的结果，现在把出借方的 `raw` / 译文 / 罗马音一起带回
  并缓存，所以借来的 QQ/KRC/AMLL 逐字歌词也走 Folia 的解析器；顺带修掉这条路径上
  `lrcTime` 未定义导致的 502（`/music/online/lyric` 在借源时一直抛 ReferenceError）。
- **原生副歌范围**：`/online/chorus` 的范围现在作为 `chorusRanges` 进 `prepare`（Folia 的
  `applyChorusRangesByTime`），不再只用来做「跳到副歌」按钮；没有范围时仍用文本重复回退。
- **行过滤规则即时生效**：改过滤词 / 预设不再需要换歌。上屏的歌词与「规则前」的文档一起留着，
  规则变化时只对这份文档重跑显示前处理（Folia 的 `lyricsBeforeRules` 语义），不重新取歌词。
- **手动词级分词**：`lyricSegmentationRecord` 的数据层进 bundle（`shared/lyricSegmentationPrompt.mjs`
  与 `src/types/lyricSegmentation.ts` 按 Folia 原样补上），客户端按 Folia 的顺序烘焙
  （用户记录 → icu-folia 默认）。界面是 Folia 的手工交换格式：每行歌词一行、`/` 分隔词边界，
  保存写进 `lyric_segmentations`（按歌曲路径），「恢复默认」删掉记录并回到文档重新烘焙。
  入口：播放器卡片 → 本地 / 音质页签的「歌词分词」。
- **换源请求可取消**：换源请求原本只挡状态写回，HTTP 不取消，连续切歌会把最多四个源的检索叠在一起。
  现在这份请求带 `AbortSignal`，切歌 / 关面板时立刻 abort（Host 侧已开始的检索仍会跑完，只是浏览器
  不再等它的结果）。
- 诊断：歌词日志仍上报 `wordLevel`；换源时额外走一次同一条解析+显示前处理。

### 歌词管线诊断上报（临时）

- `POST/GET /music/debug/report`（仅本机、内存里留最近 40 条）：客户端在三种时机自动上报——
  歌词加载完成（来源/样式/行数/词级行数/是否 Folia 解析/是否有 raw）、视觉器挂载（行数/词级行数/
  有没有 audio 元素）、播放中每 ~2 秒（时钟值/当前行号/当前行词数/行的起止时间）。
- 用来在无法看用户屏幕时确认「词级数据是否到达客户端、视觉器拿到的是哪一行」。

### 视觉器时钟对齐 Folia（含歌词偏移）

- Folia 的播放引擎只暴露**一个**应用了歌词偏移的共享时钟，所有视觉器都用它；插件此前把
  **原始 audio.currentTime** 交给视觉器，而播放器的当前行用的是 `currentTime - offsetMs`。
  只要这首歌有偏移（手调过、或从记忆里恢复），当前行和逐词扫描就会错开。
- 现在两个舞台（Folia 样式与 pendolo）的时钟都减去 `offsetMs/1000`，播放器与播放页把
  `offsetMs` 传进 `LyricStage`。
- 说明：这不会改变 `line.words` 的数据（解析层已与 Folia 一致），改的是「用哪个时间轴去
  读它」。

### 网易云歌手页：按 Folia 的两段式加载

- 与 Folia 的 `ArtistResource` 对齐：首屏只取 **10 首热门**（`ARTIST_TOP_SONG_LIMIT`），
  `/artist/songs?id=&limit=10&offset=0&order=hot` 一次小请求，列表立刻出来；
  随后后台再取 `offset=10&limit=200` 补齐（按 id 去重），失败不影响已显示的部分。
- 路由/适配器/provider 都支持 `limit` / `offset`（netease 生效，其它源一次返回全量）。
- 同一会话里再次进入同一个歌手直接复用已加载的列表（Folia 的 artist resource 也是按
  key 缓存的），不重新请求。
- 与 Folia 的差异（有意）：Folia 还会并行请求 `/artist/detail`（头像/简介/专辑数）并在
  后台分页 `/artist/album`；我们的歌手页只有歌曲列表，所以这两样没有做。Folia 的「全部
  歌曲」是单独一页按需分页，我们是自动补齐。
- 测试：live 段断言第一页 10 首、第二页 10 首且窗口前移。

### 网易云歌手页：改走 Folia 的 `/artist/songs` 单次请求

- 之前慢的原因：`artistSongs('netease', 名字)` 根本不是歌手接口，而是**按歌手名做歌曲
  搜索**，最多 10 页、每页 30 条**串行**请求，再按歌手过滤——每点一次歌手 2–4 秒。
- 现在与 Folia 一致：歌曲本身就带 `artistsDetail[].id`，客户端把对应 id 传给
  `/online/artist-songs?artistId=…`，Host 直接 `/artist/songs?id=&limit=200&order=hot`
  一次拿回。没有 id 时用一次歌手搜索（`/search?type=100`）解析并缓存（400 条 LRU），
  仍然失败才回退到按名搜索——回退路径的分页也改成并行。
- 实测（匿名、worker 已热）：`findArtistId` 176ms、`getArtistSongs(200)` 333ms；
  provider 名字路径约 355ms；带 id 路径一次请求。旧路径最多 10 次串行搜索。
- 测试：live 段断言名字→id、缓存命中、`/artist/songs` 返回完整歌曲、provider 用 id 直接回答。

### 歌词行与 Folia 原样对齐（去掉二次加工）

- 播放器的歌词行改成 Folia 的 `Line`（`startTime` / `endTime` / `fullText` /
  `words[].startTime`）。`LyricData.lines` 按引用进状态，视觉器拿到的是同一批对象，
  插件只额外加 `sourceIndex`（舞台用它把播放器的行号映射到过滤后的数组）。
- 旧的 `{time, end, text, words:[{t,end,text}]}` 只在边缘转换一次
  （`legacyLinesToFolia`）：Host `/lyrics`（本地）、LRC 回退、歌词匹配对话框。
- `foliaStyleLines` 不再重建 `words`。之前它按 `{t,end}` 读 Folia 的词，拿到
  `undefined` 后时间全是 0，等于把解析结果又打乱一次；现在只做 staff 策略与空行过滤，
  与 Folia 的「解析完直接交给视觉器」一致。
- `foliaPendoloLines` 遇到 Folia 行直接透传（含 `renderHints` / `wordSegments` /
  `autoWordSegments` / `isChorus` / `backgroundVocals` 等全部字段）。
- 行的开始/结束统一走 `mpLineStart` / `mpLineEnd`（兼容旧形状），播放器、播放页、
  作曲器、导出 LRC 都用它。
- 顺带修：`foliaPlainFallback` 读 `line.fullText`（原来只读 `line.text`，Folia 行会空白）。
- legacy 行的结束时间也按 Folia 的规则补：没有 `end` 时取下一行的 `startTime`，
  只有最后一行才用固定跨度。
- 验证：真实网易云响应 49 行按引用透传（`lines[0] === doc.lines[0]`，`words` /
  `renderHints` 同一引用）；legacy 形状转换一次；全量测试与 check 全过。

### 修复：歌词样式闪烁 / 抖动 / 空白的无限重载

- 回归来自 icu-folia 的「引擎就绪后重烘焙」：`icuLoad.then` 用一个本次 effect
  内的 `appliedAutoSegmentation` 判断要不要 `setLyricReload`。但引擎加载 promise
  在解析歌词的 `await` 之前就 resolve，回调先跑，标志还是 false，于是每一轮都重载，
  形成「取歌词 → 解析 → setLyrics → 再重载」的死循环；`lines` 数组每轮都是新引用，
  视觉器反复重建布局——莫奈闪烁、时计抖动、浮名（lumiere）还没画完就被重置成空白。
  上一轮词典资源 404 时引擎加载返回 false，所以问题在 DSH 重启后才暴露。
- 修法：重烘焙改成模块级一次性开关（`icuFoliaRebaked`），只在引擎首次就绪时重跑
  一次歌词加载；删掉每个 effect 内的标志。
- 验证：引擎就绪时只重载一次（逻辑推演 + 构建检查 + 全量测试）；用真实网易云响应
  验证 lumiere 的 `buildStructureLines` 拿到全部 49 行（不是数据被滤掉）。

### 网易云逐词排查

- 用运行中的 Host 实测：用户最近播放的网易云歌里 27649067 / 16818144 / 17753288
  都返回 `raw: yrc`，48–61 行、42–59 行带词；445845838（イヴステッパー）网易云
  只给 LRC，没有逐字时轴。
- 把真实响应喂给构建后的客户端代码：`parse → prepare → linesFromFoliaDocument →
  foliaPendoloLines` 全程 60/60 行保留词级时间，576 个词与行文本逐一对得上
  （monet 的逐词扫描靠这个顺序对齐）。
- 客户端加一行诊断（每次在线歌词加载一次）：
  `[dsh-music] lyric <provider>/<id> style=<样式> lines=N wordLevel=M (folia|legacy)`，
  用来区分「词级没到客户端」和「样式不画逐词」。

### icu-folia 自动分词（Folia 的默认分词）

- 新增 `scripts/build-icu-folia.mjs`：从 Folia 的 `dev/icuFolia/jieba/*` 生成同一份数据
  （词典排序后的一串字 + base64 varint 频率、HMM 表、繁→简字符对），写成
  `lib/assets/icu-folia/{dict,hmm}.json.gz`（1.60MB + 0.26MB），随插件发布。
- Host 新增 `GET /music/assets/icu-folia/<dict|hmm>.json.gz`，带
  `Content-Encoding: gzip` 由浏览器透明解压；只认这两个名字，一年缓存。
- 歌词 bundle 增加 `loadIcuFoliaFromData(data)`：按 Folia `engines.ts` 的同一套步骤
  （jieba + 繁简映射 + BudouX）构造引擎；Vite 的两个虚拟模块在构建时换成空桩，
  默认加载器永远不会被走到。`applyAutoWordSegmentation` / `isIcuFoliaReady` 一并导出。
- 客户端在第一次取在线歌词时按需拉这两份数据；引擎就绪后把当前歌词重新烘焙一次
  （`setLyricReload`），与 Folia 的 `useIcuFoliaSegmentation` 行为一致。
- 测试：路由断言（gzip 头、真实大小、未知名字 404）；歌词 bundle 测试用真实数据构造
  引擎并断言中文行被切成词且拼回原文。

### 歌词过滤与时间轴偏移记忆（Folia 的 lyricLineRules / lyricOffsetMemory）

- 歌词行过滤接上 Folia 的规则引擎：设置 → 歌词 里多了「过滤版权声明行」「过滤歌词来源行」
  两个开关（Folia 的两个内置词表），加一个「自定义过滤词」（逗号或换行分隔，包含即隐藏）。
  两个列表在 `prefs`（`lyricFilterPresets` / `lyricFilterWords`），客户端折成 Folia 的
  `LyricLineRule`（`preset` / `contains`）传给 `prepare()`，顺序与 Folia 一致：先过滤行，
  再跑 staff credits 策略、合唱。
- 时间轴偏移改用 Folia 的 `lyricOffsetMemory`：每首歌记住手调的偏移
  （localStorage `lyric_timeline_offsets`，最多 1000 首），切歌时恢复而不是清零。
  线上歌以前根本没有偏移控制（`applyOffset` 直接 return），现在有：调整即记住；
  本地歌仍以 Host 的文件级偏移为主，并继续写入 `lyrics/calibrate`。
- 测试：`lyrics-folia.test` 覆盖预设/自定义词过滤、无规则不过滤、偏移读写与持久化键；
  `panel.render` 覆盖 `prefs` → 规则的折算和偏移的读/记。

### 歌词显示流水线对齐 Folia（staff credits / 合唱）

- 歌词 bundle 新增 `prepare()`，对应 Folia 的 `createLyricsSetter` 显示前那一段：
  先跑 staff credits 策略（`keep` / `smart` / `hide`，默认 smart，按前奏时间预算
  决定保留、重排还是整块隐藏），再跑合唱装饰：歌词自带 `isChorus` 就用它，否则用
  时间区间（`applyChorusRangesByTime`），再否则用 Folia 的文本重复检测
  （`applyDetectedChorusEffects`）。
- 逐字移植了 Folia 的 `src/utils/chorusDetector.ts`（合唱检测），歌词 bundle 因此多 15KB。
- 客户端在 `MPFoliaLyrics.parse` 之后调用 `prepare`（目前策略固定 `smart`），
  `isChorus` 随行进入渲染器和视觉器。
- 仍没接的两块（Folia 有、插件还没有对应设置面）：用户按歌曲保存的分词
  （`applyLyricWordSegmentation` + 分词 store）、icu-folia 的自动分词（依赖 Vite 虚拟
  字典，插件 bundle 里没有；在 Folia 里也是引擎就绪前不起作用）。
- 测试：staff 的 hide / keep 两条路径、文本重复检测标出合唱；staff 样本里 Folia 会插入
  `......` 间奏行，隐藏只针对署名块，间奏保留。
- 解析后的原始 Folia Line 挂在渲染行上（`line.folia`），`foliaPendoloLines` 把它携带的
  `renderHints` / `wordSegments` / `autoWordSegments` / `chorusEffect` / `songPart` /
  `blockIndex` / `alternateTexts` / `backgroundVocal(s)` / `agentId` 一并交给视觉器样式
  （以前只传 words/translation/romanization，样式里的逐词/转场渲染参数一直是默认值）。
  `panel.render` 增加断言：renderHints 从文档一路活到样式行。
- 纯音乐判定接上 Folia 的规则：整行就是「纯音乐，请欣赏」这类提示语时按无歌词处理
  （视觉器走纯音乐路径），只是正文里出现「纯音乐」三个字不算；`isPureMusicLyricText` /
  `isPureMusicLyricLines` 从 bundle 导出并在解析后跑一次。

### 歌词处理逻辑改用 Folia 的流水线

- `src/utils/lyrics/**` 本来就与 Folia 逐字一致（解析器、staff credits 策略、合唱效果、
  render hints 都在），但从来没被编译进客户端：插件自己的歌词是 `parseLrcText` +
  `attachWordTimeline` 手解析的。
- 新增 `src/render/lyrics/entry.ts` + `scripts/build-lyrics.mjs`，把
  `LyricParserFactory.parse` 编成 `lyrics.bundle.js`（`MPFoliaLyrics`）。Folia 的歌词
  解析跑在 Web Worker 里，插件客户端是一段拼接脚本没有 worker 资源，所以
  `workerClient` 在构建时换成同线程实现（`src/render/lyrics/worker-inline.ts`），
  跑的是同一个 `parseLyricsByFormat`。
- Host 在歌词结果里多带一份 Folia 的原始来源：网易云 `{type:'local', formatHint:'yrc'}`、
  QQ `{type:'qrc', qrcContent}`、酷狗 `{type:'local', formatHint:'krc'}`（KRC 只下一次，
  明文同时喂解析器和兜底）；歌词缓存 v5 → v6。客户端有 `raw` 时走
  `MPFoliaLyrics.parse`，没有时仍回退旧解析。
- 逐词、翻译/罗马音、`isWordByWord`、staff credits 判定都由 Folia 的解析器给出；
  播放器与视觉器读同一份 `{time,end,text,translation,words}`。
- 新增 `test/lyrics-folia.test.mjs`：在 Node 的 `vm` 里加载 bundle，验证 enhanced LRC /
  QRC / YRC / TTML 四种输入都产出词级时间轴；实测四个平台（网易云/QQ/酷狗/概念版）
  的 raw 经解析器都是逐词（60/63/63/63 行全带词）。

### 逐词歌词：QQ 与酷狗补上下发

- 渲染端本来就支持逐词：客户端把 Host 回的 `lines[].words` 按行时间合到 LRC 行上
  （`attachWordTimeline`），Folia 舞台按 `line.words` 精确驱动（没有词级时才用
  `buildTimedWords` 按字数均分的兜底）。真正丢词的是 Host：
  - QQ：`getQrcLyric` 解析出了 `words` 却标着「当前不下发」，provider 的 QQ 分支只回
    `{lrc, translation}`，QRC 只在需要翻译时才请求。
  - 酷狗：`getWordLines` 把 `words` 从每行删掉再返回，provider 只回 LRC。
- 现在 QQ 的 QRC 行带 `words`（秒时基），provider 优先用 QRC 行、并用同一批行拼 LRC
  （时间轴严格对齐，客户端的按时间配对才能命中）；酷狗的 KRC 行保留 `words`，provider
  在有词级时用 KRC 行拼 LRC。没有词级数据时照旧回退 LRC / 翻译路径。
- 歌词缓存版本 v4 → v5：旧缓存没有词，会重新取一次。
- 实测（匿名）：网易云 67 行、57 行带词；QQ 与酷狗（标准版与概念版）63 行全部带词。
- 测试：`parseQrc` 的词解析断言；`kugou-upstream` live 段断言 KRC 词级下发。

### 向 Folia 对齐：酷狗走上游包（第一步：登录与设备）

- 新增 `lib/services/kugou-api.js` + `kugou-worker.js`：`kugoumusicapi` 放进 worker 跑，
  调用形状与 Folia 的 `kugouApiBridge.cjs` 一致（`callKugou(platform, operation, params)`
  → `{ status, body, cookie }`）。包在 require 时读 `process.env.platform`（appid、
  clientver、Android 盐），所以按平台各起一个 worker：`standard` 与 `lite`（概念版），
  每个 worker 有自己的一份 env。
- 新增 `lib/providers/kugou-cookie.js`：把插件存的设备身份与登录态翻成包认识的 cookie
  词汇（`KUGOU_API_GUID/MID/DEV/MAC/WEBGL`、`dfid`、`userid`、`token`）；老会话没有
  指纹字段时按 guid 派生稳定的值。应答里的 `dfid`，以及「确认登录（status 4）时才成对取
  token/userid」按 Folia 的规则合并，半对不取。
- 扫码登录与设备注册改走包：`createQRLogin` → `login_qr_key`（缺图再 `login_qr_create`）、
  `checkQRLogin` → `login_qr_check`、`registerDevice` → `register_dev`；标准版与概念版
  都走这条，概念版也先注册设备。`kugouRegistered` 缓存按平台分开，插件卸载时停掉两个 worker。
- 搜索也改走包（`complexsearch` 的 Android 接口）：上游的 `OriSongName` / `HQ.Hash` /
  `SQ.Hash` 在调用处折成 `normalizeSong` 认识的键，两个平台各用自己 worker 的签名；
  实测 480 条结果，标题/歌手/专辑/320/无损 hash 都对。
- 歌词也改走包（`search_lyric` + `lyric`，`fmt=lrc/krc` 不变，KRC 解密/解析照旧）；实测
  「晴天」LRC 1455 字、KRC 63 行，两个平台一致。
- 取流/云歌单暂时仍是自写协议（下一步迁）；登录后的 `dfid` 已经是包签发的那个。
- 新增 `test/kugou-upstream.test.mjs`：cookie 词表、应答合并、登录映射的纯断言；
  `DSH_MUSIC_UPSTREAM=1` 时两个平台各真出一次码、轮询 waiting，并做一次匿名搜索。

### 向 Folia 对齐：QQ 扫码失败时说出具体原因

- QQ 上游包在扫码失败时会给一条 `failureHint`（设备上限 / 请求过频 / 扫错 App /
  账号受限 / 平台拒绝，见它的 `loginHints`）。插件以前把它丢掉，登录窗只能说
  「平台拒绝了这次登录」；现在 `qq.checkQRLogin` 带上 hint、重试等待和失败环节，
  `providers.loginStatus` 把 hint 折成 Folia 的 case（`device-limit` /
  `retry-later` / `wrong-scan-app` / `account-restricted` / `refused`），
  经 bridge 和状态机一路带到登录路由，最终显示成对应的中文说明。
- `qq-upstream` 补了 hint → case 的断言（含 unknown code 仍是普通失败）。

### 向 Folia 对齐：登录失败改名成有名字的情况

- 新增 `lib/core/login-failure.js`：照 Folia 的 `loginFailureCase.ts`，把登录失败的
  事实（步骤、HTTP 状态、retry-after、是否网络层失败）归成有名字的情况
  （`code-expired` / `expired-after-scan` / `unreachable` / `refused` /
  `retry-later` / `device-limit` / `wrong-scan-app` / `local-service-unavailable` /
  `account-not-read` / `unknown` …），每种带 Folia 的 kind / action / details。
- `/online/login/start`、`/online/login/status` 失败时把情况放进回答
  （`error.failure` + `error.facts`），`error.message` 换成这一种情况的中文说明。
  客户端本来就把 `error.message` 显示在登录窗里，所以现在看到的是
  「连不上平台，请检查网络或代理」「本地登录服务不可用」这类话，而不是上游原文。
- `fail()` 支持附加字段；`login.test` 补了分类表、事实和回答形状的断言。

### 向 Folia 对齐：网易云扫码的两条上游策略

- 扫码两步（要码 / 轮询）遇到网络层失败时重发一次：上游把连接被重置答成
  `{ status: 502, body: { msg } }`，而同一个请求前后的请求都正常，单次重置不该结束一次登录。
  照 Folia 的 `withQrNetworkRetry`，每次尝试各复制一份 `data` / `options`（上游会往里写）。
- 替换上游的 `module/login_qr_check`：它 `catch` 里读的是 `try` 里声明的 `result`，请求被拒时
  抛 ReferenceError，server.js 把没有 body 的错误一律答成 404——登录窗分不清“连不上”和“被拒绝”。
  换掉之后被拒绝的回答按它自己的 status / body 回给页面（`createLoginQrCheck`）。
- 两条策略和客户端 IP 策略一起由 `installUpstreamPolicies` 装进包的 require 缓存；worker 的
  ready 消息带 `policies`，`ensureNeteaseService()` 的句柄原样交给调用方，live 测试断言
  `clientIpPolicy` / `loginQrCheck` 都是 true。

### 向 Folia 对齐：网易云的客户端 IP

- 网易云本地服务不再把本机地址当成来源 IP 发给平台：worker 加载上游之前替换包的
  `util/request` 导出（`lib/services/netease-upstream.js` 的 `withoutImplicitClientIp`），
  只有显式要求随机国内 IP（`randomCNIP`）的请求才带 `X-Real-IP` / `X-Forwarded-For`。
  做法照 Folia 的 `electron/netease/neteaseApiStartup.cjs`——那边记过：上游默认会把
  127.0.0.1 写进去，而扫码确认这一步会被平台判成来源不对而失败。
- worker 现在先建好 `os.tmpdir()/anonymous_token` 再加载该模块（上游在模块加载时就读它），
  并把「策略有没有装上」放进 ready 消息：`ensureNeteaseService()` 返回的句柄带
  `clientIpPolicy`，live 测试断言它为 true。

### 登录窗换成 Folia 原版

- 登录窗不再是手写的 `.mp-login-*` 版面：`src/render/login/folia-src/**` 是 Folia
  `src/components/login/**` 的逐字副本，加上它依赖的 `Sheet` 与 settings kit，按 Folia
  的 `src/` 目录镜像摆放，上游的相对导入一行不改。窗口 772×420、212 宽的平台列、
  200 的画块、标题前飞入的平台记号、等待时的圆环、扫码/已扫/失败的各一幅、登录成功的
  flood 动画都是 Folia 自己的代码在画。
- `scripts/build-login-folia.mjs` 用 esbuild 把 `entry.tsx` 编成
  `folia-login.bundle.js`；只替换 Host 边界：React（`MP_HOST_REACT`）、
  react-dom 的 portal、react-i18next（走插件自己的 `t`，`MP_LOGIN_T`）、
  framer-motion（`MPFramer`）；lucide-react 在构建时打进包里。
- `scripts/build-login-css.mjs` 用 Tailwind v4 只为这棵子树编译 CSS，再把每个选择器
  加上 `.mp-login-layer` 作用域（面板和 Host 共用一个文档，工具类名会撞）；
  `login.css` / `kit.css` 一并注入，旧的 `.mp-login-*` 版面与手写的登录成功动画不再使用。
- 补充了 Folia 登录窗用到的 90 个 i18n 键（`login.*` / `home.*` / `status.*` /
  `ui.close`），从 Folia 的 zh-CN / en 复制，`{{name}}` 改成插件的 `{name}`。
- `src/render/login/login-dialog.js` 是唯一接缝：把 Host 的登录会话映射成
  `LoginScreen` 的 props，Host 仍然拥有 QR 状态机。
- 登录窗的渲染进 `panel.render.test`（`.mp-login-layer` + Folia 的 `st-window` 与标题）。

### 扫码登录

- 修好网易云 / QQ 扫码登录：二维码刚出来就被判成「平台拒绝了这次登录」。
  根因在上游传输层的成功码闸门：`/login/qr/check` 的 `code` 是扫码状态
  （800 过期 / 801 等待 / 802 已扫 / 803 成功），而 `assertOk`（网易云）和
  `callUpstream` 的 code 判断（QQ）只认 200，于是每一轮“等待扫码”都被当异常抛出，
  登录状态机直接进 `error`，窗口把上游的 `等待扫码` / `Waiting for QR scan`
  当成失败原因显示。现在 `callUpstream` 支持 `skipCodeCheck`，只有扫码轮询用它，
  其余接口的成功码规则不变。
- `netease-upstream` / `qq-upstream` 补了成功码闸门的纯断言；`DSH_MUSIC_UPSTREAM=1`
  的 live 段补了「出码后第一轮轮询必须是 waiting」。之前 live 段只测出码、不测轮询，
  所以这条路径一直没被覆盖。

### Folia 式登录页

- 新增 `src/45-login-controller.js`：Folia 形状的账户 controller 快照
  `{ login, lastLoginCompletion, setup }`，方法包括 `startLogin / closeLogin / retryLogin /
  selectLoginMethod / submitFormLogin / requestSwitch / logout / openLoginPage /
  restartLocalService / buildLoginDiagnosticReport`。
- 登录窗不再自己维护 QR/状态/轮询，改为只读 controller；扫码、scanned、成功、过期、失败、
  重试都走同一份会话状态。这是 B（替换登录状态机）的第一步。
- 仍未替换：Navidrome 表单仍走 `useNavidromeForm`，`submitFormLogin` 已备好但未接 UI；
  setup 清单、失败分类/自检、完成动画、平台切换的完整语义还在后续步骤。
- Navidrome 表单现在提交给 `loginController.submitFormLogin`（校验留在窗口里），不再自己
  `postJson`；账号页在选中的平台不是当前源时多一个“切换至该平台”，走 `requestSwitch`。
- 登录失败按 controller 的 `failure` 显示标题、原因、“详情”（平台/case/时间）和“复制诊断信息”
  （走 `buildLoginDiagnosticReport`）。
- 登录成功加了一层 Folia 风格的完成画面：平台色铺满窗口、头像、白色对勾和“登录成功”，
  只在真正的登录成功跳变时出现；这不是 Folia 的逐帧 `LoginDone` 动画，后续再换。
- Host 新增 `/online/login/session`：返回 Folia 形状的
  `{ login: { providerId, phase, codeImage, failure, ... }, lastLoginCompletion, setup }`；
  客户端 controller 不再拿着 key 轮询，Host 持有 QR 状态机。
- 删除旧的 `/online/login/status` 路由和客户端 `checkProviderLogin`，登录状态只走 session 快照。
- `login.test` 补了 `accountSessionOf` 的 phase/failure 映射断言。
- 失败标题按 case 区分（二维码过期 / 网络不可达 / 平台拒绝 / 表单失败）；详情里带
  case、类别、环节。
- 完成画面补了平台水印和 `平台 · ID` 第二行，更接近 Folia 的 flood 层。
- 直接移植了 Folia `loginDoneFrame` 的时间轴（front 110 / shown 740 / leave 1260 / end 1800），
  用 rAF 按帧写头像、两行字、水印和对勾的 opacity/transform；`login-done-frame.test.mjs`
  校验关键时刻的数值。
- 完成画面补了 Folia 的 flood 层：深色底上按 `frame.front` 从 200 方块中心（334,210）以
  `clip-path: circle()` 扩到整窗，而不是一上来整块变色。
- **整包 vendor 第一步**：Folia `src/components/login/**` 原文件已放入
  `src/render/login/folia-src`；用 esbuild 把原 `LoginWindow.tsx` 编成
  `folia-login-window.bundle.js`（React 走宿主、Sheet/PlatformMark/motion 用 shim）。
- `LoginDialog` 现在优先渲染这个原 `LoginWindow`（标题行、titleLead、aside、body 用 Folia 的
  Sheet 结构），旧手写窗口只作 bundle 缺失时的回退；`panel.render` 增加登录层渲染断言。
- 仍待 vendor：`PlatformColumn / LoginTile / LoginMessage / FormLogin` 原组件。
- 扫码确认后 200 方块里出现手机和 `login-arc` 转圈；完成画面补了头像外圈的 ping。
- 删掉 bridge 里没人用的 `submit` 分支，密码登录只走 controller。`SetupChecklist` 仍等平台（M3）。

- 登录窗口按 Folia 的 LoginWindow 版面重做：772 宽 / 至少 420 高的窗口，左侧 212 宽的
  平台列，右侧标题栏 + 200×200 的登录块 + 说明/操作区；窄屏时平台列横到上面。
- 左侧平台行：平台 logo、名称、登录状态和已登录头像，当前行有蓝色指示条。
- 账号状态：200 方块里是 88 头像，右侧昵称、平台与账号 ID、“同步数据”“退出登录”；
  同步会真实重读平台账号/歌单，不是假按钮。
- 扫码状态：200 白底方块里是 176 二维码，右侧标题、状态、步骤和失败后的刷新。
- 表单登录（Navidrome）与“仅外部播放”的平台各有对应画面。
- 登录成功不自动关窗，就地切成账号画面。
- 播放设置 → 音质页的头像/名称或右上角图标可直接打开登录窗口。
- 扫码页按 Folia 再对齐：使用「使用{平台}APP扫码 / 打开{平台}APP > 发现 > 扫一扫」文案、
  200×200 白底二维码块、右下角「扫码 → 手机 → 账号」步骤图标，以及平台色的窗口渐变/圆环。
- 登录方式补了能力位回退：旧 Host 的 provider 摘要没有 `loginMethods` 时，按
  `loginQr` / `loginPassword` 能力判断，网易云等平台不会再误显示“只能在外部播放器登录”。

### 平台支持架构（对齐 Folia）

- 能力位扩展到 Folia 的集合（`auth`、`userLibrary`、`recommendations`、`wordByWordLyrics`、
  `userAlbums`、`mutations`、`playlistTrackMutations`、`playlistSubscription`、`externalPlayback`、
  `explore`、`personalFmModes`、`playbackReports`、`userCloud`、`listeningRank`、
  `historyRecommendations`、`dailyStyleRecommendations`、`recommendationPreferences`）。
- 每个平台独立声明能力：网易云 / QQ / 酷狗 / 酷狗概念版 / Navidrome 不再共用一组“中国平台能力”。
- 新增每平台音质档位 `qualityLevels`（酷狗系无 hires、Navidrome 为 original），`omni.qualityLevels()`
  读取；播放设置里的音质选项按平台过滤。
- 新增 `loginMethods`（qr / password / external），由能力位推导，登录页/设置页不再按平台名分支。
- 新增 `providerApi(source)`：把扁平方法分组为 `search / playback / lyrics / library / catalog /
  mutations` 的 namespace 视图，供后续登录页和新平台使用；现有路由继续走扁平方法。
- 本地音乐与在线平台使用同一 source 形状（本地：`kind: local`、`original` 音质、无登录方式）。
- 架构说明见 `A_other/docs/平台支持架构.md`。

### Folia 歌词样式（16 种全量接入）

- 新增 14 个按 Folia 源码编译的歌词样式：**静止 / 云阶 / 浮名 / 莫奈 / 群唱 / 倾诉 / 回环 /
  心象 / 绘光 / 商籁 / 凝彩 / 花火 / 雾笺 / 镜台**；加上原有的**时计**和已编好的**町景**
  引擎，共 16 个。渲染器、Pixi/WebGL/Three 程序、分镜与排版代码均来自上游，未重写。
- **移除经典样式**，默认样式改为**莫奈**；旧 `standard/glow/outline/karaoke/mirror` 偏好自动
  迁移到莫奈，未知样式也回退莫奈（样式不可用时回退普通文本列表）。
- 统一由 `FoliaStyleHost` 驱动：Folia `MotionValue` 时钟、五条音频带、`Line[]`（含逐字
  `words`）与 `Theme`；样式只创建一次，换句不重建画布/上下文。
- Pixi 8.21 与 `@react-three/fiber@9.8.2` 已 vendor；framer-motion 复用插件内联实例；设置面板/
  QuickControls 走边界 no-op；缺素材的群唱/凝彩/雾笺走上游 fallback。
- 样式错误边界：单个样式运行时失败会回退普通文本列表，不白屏。
- 镜台：宿主 React 为 18.3.1，因此使用 `@react-three/fiber@8.18.0`（R3F 9 需要 React 19，
  之前会触发样式错误边界并回退普通文本）；已在 React 18 隔离页验证 3D 场景正常出画。
- 修复 DOM 类 Folia 样式（静止/莫奈/浮名/群唱/云阶/倾诉/町景）布局错乱：这些样式依赖
  Tailwind utility，之前只注入了手写子集；现在用 Tailwind 4 从样式源码生成完整 utility
  （`src/render/folia/folia-tailwind.js`，作用域 `.mp-np`）随播放页注入。
- 心象空白：`VisualizerShell` 的边界 shim 没有 `forwardRef`，心象把 `ref` 挂在 shell 上拿到 null，
  `ResizeObserver` 从不启动，viewport 永远是 0 → 不排版/不绘制。现在 shell 转发 ref。
- 町景空白：之前直接 `new MachiRuntime(...)`，绕过了 `MachiRuntime.create()` 的异步场景加载和
  `start()`；同时 three examples 的后处理是空 stub、`scene:auto` 可能选中未打包的场景。现在改用
  `create()`、vendored 真实 EffectComposer/UnrealBloomPass/FXAA/SMAA，并把场景固定为已移植的
  `konbini`；商店街、雪、LED 歌词屏正常出画。
- 浮名画布只显示右半边：Tailwind 的 `-translate-x-1/2` 依赖 `@property` 注册的自定义属性，
  之前 `@property` 被错误地嵌套进 `.mp-np` 而失效；现在 `@property` 保持在顶层，画布正确居中。
- 云阶：framer variants 在 `custom` 缺失时会读 `config.x` 抛错，已加防御；样式错误边界
  现在按样式 id 重新挂载，切到云阶出错后切回其他样式不会再一直停在回退界面。
- 播放页的歌词宽度分隔条只属于经典双栏布局：Folia 样式是全屏舞台，没有“歌词栏宽度”，
  现在在可视化样式下隐藏这两个分隔条，避免出现拖不动的控制；Folia 舞台恢复接收指针事件，
  逐行点击/拖动跳转等样式内交互可以正常工作。
- 主题改为 Folia 的 **封面取色生成器**（`builtinTheme` + `themeColorMath`）：每首歌提取一次
  封面色，生成 light/dark 主题，样式与背景共用缓存。
- 群唱的内置头像/表情使用 Folia 原素材，由宿主 `/music/assets` 路由提供；不再内联进 bundle。
- 移植规则、边界与验收标准见 `A_other/docs/Folia可视化移植手册.md`。

### Folia 音频输入与上游对齐

- 播放页背景 / 歌词样式的音频带改由 `src/render/styles/folia-audio.js` 生成，逐行对齐上游
  `usePlaybackVisualizerBridge`：`fftSize 2048`、21.5 Hz 分段、同样的 power 曲线、0–255 量纲，
  空闲帧同样是上游的慢呼吸而不是 0。
- 补上 Folia 的原始频谱 `audioBands.spectrum`（1024 bins，按帧拷贝）；莫奈底部频谱条现在与上游
  一样按原始 FFT 绘制，不再回退到五段插值。
- 分析器 `smoothingTimeConstant` 0.82 → 0.6，与上游 `usePlaybackAudioBridge` 一致；背景对鼓点
  的响应不再被额外平滑（侧栏 / 播放页的频谱本来就会自己做峰值归一化，观感只会更跟手）。
- 暂停时不写新的 bands（保持最后一帧），交叉淡入期间按交叉淡入状态继续读取分析器，背景不会在
  过渡中途掉回呼吸值。
- 仍未接入 beat_this 智能节拍：背景的“起音”来自频段能量差分，与 Folia 关闭智能动感时的行为一致。
- **修复背景的音频扭曲与暂停减速完全失效**：Folia 跑 React 19，函数组件把 `ref` 当普通 prop
  透传；宿主是 React 18.3.1，`memo(function …)` 不转发 ref，`latent` 的 `paperShaderMount` 一直
  是 null，逐帧的 `setSpeed` / `u_distortion` / `u_swirl` 与 `nomand` 的首帧检测全部不执行。
  现在把 vendored `paper-shaders-react` 的 7 个包装改为 `memo(forwardRef(...))` 并把 `ref`
  交给 `ShaderMount`，重建 `backgrounds.bundle.js`。效果：隐现（流体/混合）随鼓点扭曲、加速，
  暂停时降到 12% 速度（近乎停住），与 Folia 一致。

### 播放页底栏

- 补上 Folia 式浮动播放条（居中、玻璃胶囊）：上一首 / 播放暂停 / 下一首、曲名、可拖动进度与
  两侧时间、循环模式、队列；队列浮层锚在胶囊的队列按钮上。
- 右下角控制改为 Folia 的玻璃样式：48px 半透明圆钮 + 悬停展开的 96px 玻璃轨道，替换原来的
  白色圆形按钮；点击仍打开播放设置面板。
- 胶囊与右下角手柄 3 秒无操作后淡出（下移 10px），鼠标移动 / 点击立即回来；打开设置、队列、
  歌词编辑等面板时保持可见。
- 修复播放设置面板的「播放列表」页：标签不再被截断，内容改为卡片里的队列列表（之前误用了
  只给侧栏用的 `.mp-queue`，在卡片里是 `display:none`，所以列表完全不显示）。
- 播放列表卡片内容最高 420px，超出后在卡片内滚动，不再一直长到窗口顶部。

### 本地主题生成

- 主题来源里的「AI 主题」改为真实的**本地主题**：不再只取封面强调色，而是用封面色板 + 歌词
  情绪词典在本地生成一份 Folia 形状的深色主题（名字、描述、强调色、歌词关键词配色），不联网、
  不接模型、不需要 key。
- 歌曲切到本地主题时自动生成并缓存（按播放路径），歌词变化会重新生成；「生成本地主题」按钮
  强制生成一个新变体。生成失败时继续用原来的封面主题，不影响页面。
- 生成器在 `src/render/styles/folia-local-theme.js`；`useFoliaCoverTheme` 订阅它，歌词样式、
  时计和背景一起换主题。

### 音质面板

- 播放设置 → 音质页按 Folia 的账户页重做：当前在线账号（头像、昵称、VIP、平台账号 ID、
  登出）、默认音质、信号链路，以及本地曲目的实际编码 / 采样率 / 码率。
- 修复「默认音质」从未传到 Host：在线流 URL 现在带 `quality`，Host 按请求选择音质，并按音质
  区分缓存（旧的、没有质量标记的缓存继续可用）。
- 本地音乐不转码，始终按原文件播放；页面会明确写出这一点，音质选项只影响在线曲目。

### 播放页空歌词

- 没有歌词时不再在页面中央显示「暂无歌词」图标与文字，播放页只留背景与样式舞台（设置按钮照常可用）。

### 播放页控制按钮

- 播放页右下角新增 Folia 风格的圆形设置按钮（滑杆图标），点击打开原来的播放控制面板
  （封面 / 本地 / 控制 / 播放列表 / 音质）；歌词栏里的「词」「译」徽标已移除，
  歌词翻译改为「本地」页里的开关（与 `showTranslation` 同一偏好）。
  面板从按钮上方展开，位置随按钮计算；按钮在经典布局与全屏可视化布局下都常驻。

### Folia 背景（六种全部接入）

- 播放页背景改为 **Folia 的 shell 背景系统**，原样移植 `backgrounds/` 下的六个模式：
  `common`（封面流体 + 几何图形）、`monet`（画布海报处理）、`nomand`（Paper Shaders 抖动/
  条纹玻璃/半调/镜头畸变/纸纹）、`latent`（隐现：Paper Shaders 网格 + 像素点阵）、`sora`
  （twgl 星空）、`url`（嵌入式网页）。背景渲染器、调色与动画代码均来自上游，未做重写。
- 旧的“环境流光 / 模糊封面 / 场景叠加”背景已从播放页移除；外观 → 背景选择器改为上述六种
  加“空”，默认 `latent`，旧的 flow/cover/aurora/stars/off 值自动迁移。`url` 模式可填地址。
- 背景挂在插件播放页内部（`FoliaBackgroundHost`），不是全局层；MONET 的海报在
  `OffscreenCanvas` 上由上游 `paintMonetBackground` 同步绘制（本项目没有独立 worker 文件，
  这是构建边界，不改画面算法）。

### 时计（Folia 原版）与歌词舞台

- 时计样式改为 **Folia `pendolo` 渲染器的原样移植**：齿轮机芯（WebGL2，Canvas2D 回退）、
  弧形歌词轨道、表盘投影、封面与主题、逐字扫光与字色全部使用上游代码；此前仓库里的时计只是
  一百行左右的示意实现，已删除。移植代码在 `src/render/folia/`，由
  `scripts/build-pendolo.mjs` 编译为 `pendolo.bundle.js`。
- 补齐 Folia 的输入边界：插件歌词行 → Folia `Line`（含 `fullText`、秒级起止、逐字时间线；
  LRC 行用上游 `buildTimedWords` / `estimateLrcLineEndTime` 估算）、`Theme`（封面强调色转成
  Folia 能解析的 hex，统一字体栈）、五条音频带与 `audioPower`（来自播放器 analyser）。
- 修复所有歌词舞台的生命周期：画布 / Pixi / Three 渲染器现在**只在样式变化时创建一次**，
  帧循环从 ref 读取最新 props；换句不再销毁重建（此前每句重建 Pixi Application / WebGL
  上下文、粒子与镜头归零），句内时间不再被 effect 闭包冻结，`state.now` 每帧都是最新值。

### 客户端动效（与 Folia 同一引擎）

- `client.js` 现在内联 **framer-motion 14**（`src/vendor/framer.bundle.js`，由
  `node scripts/build-vendor.mjs` 用 esbuild 生成并提交），播放页卡片改用与 Folia
  相同的 `motion.div` / `AnimatePresence` / `layoutId` 共享元素：
  入场 `{opacity:0, scale:.92} → 1`（.3s，`cubic-bezier(.22,1,.36,1)`，origin 右下）、
  退场 .22s、tab 指示条位置与宽度一起 morph、tab 内容以 `.st-page-in`
  （opacity 0 + translateY 6px，.22s）重挂。
- 宿主 React 无法承载 framer 时（精简运行时/测试环境）自动回退到 CSS 卡片，
  并在卡片上标记 `data-card-motion="css"`（正常为 `framer`）。
- 新增 devDependency `esbuild`；`framer-motion` 为运行时依赖但被打进产物。

### 在线层重构（数据层与登录）

- 新增统一的 source 契约与注册表：`lib/core`（能力位、错误码、端口分配）、`lib/sources`（registry → adapter → omni 门面），
  路由只调用 `omni`，不再按平台名分支；在线路由从 `lib/routes.js` 拆到 `lib/routes/online.js`（`routes.js` 1976 → 815 行）。
- **网易云**、**QQ** 的 transport 换为上游 API 包，各自在 `worker_threads` 中运行、由插件分配 `127.0.0.1` 端口；
  对外函数签名与返回形状保持不变，上层零改动。
- **波点音乐**作为新平台接入（`bodian-music-api`，AGPL）：搜索 / 播放 / 歌词 / 扫码登录；会话写入统一的 `sessions.json`（0600），重启后自动恢复。
- **汽水音乐**已接入依赖与适配代码，但当前网络无法连通其服务端，未注册为可用平台。
- **飞牛（fnOS）**尚未启用：需要用户自建服务器才能验证，未凭空实现接口。
- **酷狗**保留插件自有签名实现：实测上游匿名取链返回 `20028`、歌词返回 `20010`，不可用。
- 数据路由的平台白名单（22 处）改为**注册表校验**，扫码登录改为**能力位校验**：新平台接入后
  无需再修改任何路由即可被寻址；`omni.searchPage` 对只实现 `search` 的源自动做分页回退。
- 登录重构：新增状态机（`lib/login/state.js`）、新的 `sessions.json` 凭据结构（0600，`lib/login/store.js`）
  与桥接层（`lib/login/bridge.js`）；扫码登录与登出已改走状态机。旧的 `providers.json` 不再读取，升级后需重新登录一次。
- 设置页的平台列表改为注册表驱动，并且只为**声明了登录能力**的平台显示登录卡。
- 本地曲库并入同一数据层：`local` source 支持搜索（含拼音键）、分页、歌词（内嵌/侧挂）与受保护的播放 URL。
- 对齐 Folia 的在线处理方式：歌词改用 `/lyric/new`（富 JSON-lines + 逐字 YRC）、
  未登录时注册并复用匿名 cookie（`/register/anonimous`）、取链带 `randomCNIP/https`、
  新增副歌窗口 `/song/chorus`（含 `/music/online/chorus` 路由与可选能力语义）。
- 歌曲实体字段四平台统一：`artistsDetail` / `albumDetail` / `aliases` / `translatedNames` /
  `publishTime` / `popularity` / `mvId` / `isVideo` / `resourceState` / `privilegeDetail` /
  `availableQualities`（波点另含 `audios` 音质档位与 `preOnline`）。
- `parseYrc` 支持混合流：`/lyric/new` 把富 JSON 文档混进经典 YRC 时不再丢弃 credit 行。

## 0.35.0

### 播放页
- 背景改为「模糊封面 + 环境动效」：移除高开销的 WebGL 烟雾、光斑与光束，只保留封面缓慢漂浮、缩放、旋转，叠加异速回声层与节拍呼吸
- 新增「动态背景」总开关与四项参数：漂浮强度（0–300%）、漂浮速度（50–400%）、响应灵敏度（0–200%）、节拍幅度（0–300%），默认 300/400/200/300；关闭后背景完全静止
- 节拍检测改为低频段半波整流频谱通量 + 自适应阈值（快攻慢放），响应灵敏度同时影响触发门槛与命中增益，较轻的鼓点也会响应
- 进度条与音波合并为单一可拖动组件：已播放/未播放分色、播放头、悬停指示，原生 range 保留键盘与无障碍；关闭音波后仍可拖动进度
- 歌曲列表行加大（84px 行高、56px 封面、16px 标题）；歌手、专辑列表改为与歌曲列表一致的整行布局
- 修复切歌后波形仍沿用上一首封面颜色；修复浅色模式下播放页歌名变黑

### 编辑播放页
- 动态背景区域收敛为开关 + 四项滑杆；内容改为顶部起始对齐、面板自适应高度，消除大片空白

## 0.34.0

- 新增「动态流光背景」：在封面模糊底色上叠加 4 层缓慢漂移的光晕，颜色取自封面签名色；切歌时颜色约 1.1s 平滑过渡，页面隐藏时暂停、支持「减少动态效果」，可在「界面编辑」关闭
- 歌词栏可拖动调宽：左右两侧边缘皆可拖动，分隔条跟手、悬停才显示，双击复位、方向键微调，宽度按本机偏好保存
- 布局改为两栏中心线对齐：左栏取 60% 宽度处、右栏取中线，两者中点对齐界面中心；去掉左右固定内边距，两栏间距默认 60px 并可在界面编辑调整（12–96px）
- 「译」「词」按钮统一尺寸并跟随歌词对齐方式（左/中/右），「译」位于「词」左侧
- 进度条波形取色重做：签名色按「面积 × 饱和度」挑选，波形围绕签名色生成 ±16° 邻近色，不再被封面局部高饱和色块带偏
- 全屏时内容整体居中，歌词栏按可用空间自动收窄

### 编辑播放页
- 改为平板式三栏布局（≥1000px）：左侧实时预览与封面样式、中间歌词排版、右侧显示选项，一屏免滚动；窄屏回落单列
- 顶部实时预览即时反映封面样式、歌词字号/间距/对齐、翻译与模糊效果
- 页脚改为「恢复默认 + 完成」，为两栏间距与动态流光补充说明，滑块补充无障碍标签
- 黑胶预览改用独立圆形图层绘制封面，任意尺寸保持正圆与黑胶盘边

### 修复
- 单栏布局封面未水平居中
- 窄屏黑胶盘下移覆盖音质与控制区
- 移除「歌词获取顺序」选项，固定内嵌歌词优先、缺失时回退 LRC

## 0.33.2

### 修复
- 歌词缓存里的「无翻译」条目不再永久生效：带译文的平台（网易云 / QQ / 酷狗）若此前缓存了无译文歌词，24 小时后会自动重新获取（配合缓存版本 3，旧条目立即失效）；酷狗同一首歌存在多份歌词候选时优先选带译文的行数一致候选
- 酷狗部分歌曲没有翻译：同一首歌在酷狗有多份歌词候选，默认挑中的那份没有译文（例如 What Makes You Beautiful / 8edc4d…），而兄弟候选带译文。现在首选行数一致的带译文候选；同时歌词缓存版本升到 3，旧的「无翻译」缓存会自动重新获取
- 均衡器页面改为使用播放页已有的偏好快照（与音量界面同一条数据路径），避免该页签自己的订阅失效时出现「声音已变、界面不动」
- 均衡器「我的」页签点击已保存的预设时没有选中反馈（音量已变化但列表看起来没反应）：现在会标记当前套用的那一行；同时外部 store 改用 React 的 useSyncExternalStore，避免更新落在渲染与订阅之间时界面漏刷
- 在线搜索结果中点击歌曲的专辑无法打开专辑页：开启搜索时在线视图会一直渲染结果列表，而 `openOnlineAlbum` 没有像 `openOnlineArtist` 那样结束搜索状态，导致专辑页始终得不到渲染机会（本地音乐因为按「歌曲 + 专辑过滤」实现，不受影响）

### 播放页
- 全屏播放页改为内容整体居中：之前左侧留白 6.5vw、右侧 2.5vw，宽屏下整块内容偏左；现在全屏时左右留白一致
- 全屏时歌词栏限制为 560px 并居中，不再把文字拉到很靠左的位置；窄屏（<981px）的纵向布局不受影响

## 0.33.1

### 插件市场
- `package.json` 声明 `icon: icon.svg`，插件列表与市场卡片可以显示插件图标
- 更新 `description`，覆盖 0.33 的新能力（均衡器与 AutoEQ、智能过渡、列表内搜索、Navidrome）
- 新增 `docs/screenshots/icon-256.png`（由 icon.svg 内嵌位图导出），用于市场条目图标
- README 功能列表补充均衡器 / 智能过渡 / 列表内搜索，更新版本徽章与测试数量

## 0.33.0

### 播放
- 内容列表右上角的放大镜改为**在当前列表内搜索**（对应 issue #13）：点一下展开输入框，按歌名 / 歌手 / 专辑实时过滤当前歌单、专辑或本地库，不再跳到顶部全局搜索；Esc 或「取消」收起，切换列表时自动清空
- 新增「智能过渡」（设置 → 播放，或播放页「音频效果 → 音量」）：单一开关，曲末自动与下一首等功率重叠；默认关闭
- 过渡时机与长度由分析决定：播放到曲末前 14 秒时，解码当前曲目尾部与下一首头部，按 100 ms 能量窗找出「安静段」，从安静点切入并取该段长度作为重叠时长（2.5–6 秒，按剩余时间收敛）
- 只有真正的静音前奏（低于 -45 dBFS）才会被跳过；之前把「比平均电平低 10 dB 的轻声前奏」当成静音，导致下一首经常从中段开始人声。重叠上限也从 10 秒收到 6 秒，交接时新歌不会已经播掉一大段
- 同专辑连续曲目固定保持原始衔接（去掉单独的「同专辑也过渡」开关，与播放器的定位一致：整张专辑按作者设计完整播放）
- 过渡开始时界面就切换到下一首：标题、封面、歌词、进度条、媒体会话和队列高亮都会在下一首开始出声的那一刻切换，旧曲只作为淡出的幽灵继续播放到重叠结束
- 下一首只在重叠的最后 2.5 秒内淡入（此前是从重叠一开始就出声，最长提前 6 秒），旧曲仍按完整重叠时长淡出；界面也在它真正出声的那一刻才切换
- 在线曲目提前预取：开启过渡时，当前曲一开始播放就在后台把下一首在线曲目下载好（已缓存的走磁盘，未缓存的提前走网络并写入缓存），这样曲末 14 秒的准备窗口不再受首次下载速度限制；切歌或改播放顺序会取消旧的预取
- 过渡使用双 deck：下一首提前预取并单独做响度校正，与当前曲目在共享的均衡 / 限幅链上叠加，切换后主 deck 原样接管，不重启音频、不漏拍
- 暂停、切歌、拖动进度、切到单曲循环或失去播放权时会立即取消进行中的过渡，避免两首同时出声或状态错位

### 音频效果
- 播放页的音量面板升级为「音频效果」面板：「音量」与「均衡器」是同一个面板内的两个视图，切换时面板本身不更换
- 面板改为固定尺寸（340 × 400，随视口高度收缩），切换「音量 / 均衡器」或「预设 / 设备 / 我的 / 编辑」时不再改变大小，滚动只发生在内容区
- 新增 10 段图形均衡器（31 / 62 / 125 / 250 / 500 / 1k / 2k / 4k / 8k / 16k Hz，Q=1.41，±12 dB），与 AutoEQ 的固定频段一致
- 新增「设备」页签：内置约 8800 条 AutoEQ 耳机补偿曲线，可按品牌 / 型号搜索（oratory1990、Crinacle、Rtings 等来源各有标注），点一下直接套用
- 出厂预设沿用 Winamp 原版 18 组曲线，按新频段重新采样（听感保持，数值随网格变化）
- 「编辑」页提供实时频响曲线（按真实双二阶滤波器响应叠加绘制）、10 根推子（0.5 dB 步进）、前置增益与重置
- 「我的」页可把当前设置存成命名预设（上限 20 个），可重命名覆盖与删除
- 自动 headroom：按提升后的实际峰值自动衰减（最多 6 dB），输出端再加一级限幅，多段同时提升也不破音；关闭均衡器是真正的旁通
- 均衡器需要 Web Audio 音频图，开关或拖动推子时才主动建图；音源跨域时自动跳过并提示，避免变成静音
- 升级说明：频段从 Winamp 布局改为 AutoEQ 布局，旧版本保存的自定义曲线会被重置一次（出厂预设按新频段重新生成），之后不再受影响

### 播放页
- 播放队列点击切歌时只在当前曲目不在可视区时才滚动，不再整列位移
- 播放队列当前播放曲目的序号改为与插件入口一致的音频柱状波
- 输入框上方的歌词行跟随 DSH `Ctrl` + `+` / `-` 的字体缩放，文字、行高、图标与容器高度同步变化
- 输入框上方歌词在本地 / 在线曲目有翻译时显示「原文·翻译」；同一原文有多条翻译时只取第一条
- 设置 → 歌词新增「输入框歌词」与「输入框歌词翻译」开关
- 网易云地区版权限制曲目现在提示真实原因，并在切歌时显示 toast，不再误报为登录 / VIP 问题

## 0.32.0

### 播放页
- 无歌词时改为居中的歌词图标 + 「暂无歌词」，不再显示一整段说明文字
- 本地与在线曲目行支持点击歌手名称：本地进入该歌手的歌曲筛选，在线进入按歌手搜索并过滤后的歌曲列表
- 多歌手按 `/`、`、`、`&`、逗号等分隔符拆成独立链接；本地歌手页也按单个歌手分组
- 修复 QQ 音乐搜索接口返回空响应时整页报错：搜索改用 `search_for_qq_cp`（每页 30 首），歌手页改用 `GetSingerSongList` 分页取完整歌曲
- QQ 搜索结果增加「加载更多」分页，不再固定停在 30 首
- 网易云搜索同样支持分页加载更多；网易云歌手歌曲会跨多页聚合
- Navidrome 搜索上限提高到 200 首，歌手歌曲按 500 首范围过滤
- 专辑 / 歌单 / 歌手页的「全部」返回键移到工具栏左侧
- 切歌时为专辑封面、标题 / 歌手增加 170ms 淡入转场，并遵循系统的减少动态偏好；旧内容立即移除，快速连点上一首 / 下一首不再等待；歌词保持直接切换，加载期间不闪现「暂无歌词」
- 上一首 / 下一首按钮不再包在延迟 tooltip 中，避免连续点击被 host tooltip 吞掉

## 0.31.0

### 在线音乐
- 新增 Navidrome / Subsonic 在线源：服务器地址 + 用户名 / 密码登录，复用现有搜索、播放、歌词、封面、收藏与歌单链路
- 新增歌手 / 专辑卡片导航，专辑页复用现有共享专辑视图
- Navidrome 可选完整曲库分页（需主动保存密码并启用原生 API）；未启用时回退随机采样
- 封面代理只接收 id，由 Host 根据会话拼装服务器 URL
- 酷狗扫码登录路由不再接受 Navidrome，Navidrome 使用独立凭证登录
- 补充响应体大小上限与旧版 Subsonic `search3` 404 回退
- README 补充 Navidrome 隐私、完整曲库和 Subsonic 兼容说明

## 0.30.0

### 修复
- 修复首次播放启用音量均衡时，分析完成后才把增益从 1 调低造成的开头音量突变；现在分析完成后再开始播放，缓存和失败路径立即放行
- 修复平板横屏下「编辑播放页」设置面板按 `100vw` 计算宽度、右侧开关被容器裁切的问题；宽度和高度改为按父容器收缩，内容区独立滚动
- 修复网易云歌词把作词 / 作曲 / 编曲等时间相近的元数据行误配为第一句歌词翻译的问题；翻译改为全局最近优先、一对一匹配
- 修复本地 LRC 中时间相近的作词 / 作曲行被折叠成翻译的问题
- 修复部分网易云歌曲只有 YRC、没有 LRC 时显示「暂无歌词」的问题
- 修复 QQ 双语歌词拆分时 credits 可能被当成翻译的问题
- 修复只选中 1 首歌时右键仍显示批量操作菜单的问题；现在仅在选中 2 首及以上时显示批量菜单

### 播放页歌词
- 鼠标滚轮可浏览歌词，浏览时暂停自动跟随
- 模糊中心跟随视觉中心：滚到封面中间的那行保持清晰，上下两侧渐变模糊
- 滚到当前播放行时显示该句时间戳
- 滚动后 1.5 秒无操作自动回位到当前播放位置
- 点击歌词行才跳转并恢复自动跟随

### 元数据编辑
- 重做编辑页：左侧固定封面 / 曲目信息栏，右侧分组表单与歌词编辑
- 修复内容无法上下滚动的问题
- 修复底部「取消 / 保存」按钮重叠
- 歌词区增加行数与在线歌词入口

### 在线歌词
- 搜索框默认只填歌名，不再自动拼接歌手
- 歌词预览重做：歌曲信息、时间戳、原文 / 翻译上下排列、元数据弱化、返回结果
- 应用带翻译的歌词时按同时间戳写回原文和翻译，并保留 LRC 元数据

### 酷狗登录
- 普通版新增 token 定时续期（每 6 小时 / 启动时 / 设置页检查）
- 续期失败时先用资料接口确认，避免误登出
- 普通版和概念版失效后自动标记为未登录，不再显示「已登录」但所有操作失败

## 0.29.3

### 启动引导页
- 新增启动介绍页：功能概览、真实播放页预览、升级注意事项与播放页封面选择
- 每次启动后首次打开音乐插件都会显示，勾选「不再显示」后永久关闭
- 关闭按钮、X、遮罩和 Escape 在 3 秒倒计时内全部禁用，倒计时结束后才可关闭
- 升级提示独立标红，并明确「全新安装可忽略」
- 左侧使用真实播放页截图（方形 / 黑胶两套），右侧封面选择会即时切换预览并写入实际设置
- 调整底部操作区，使「不再显示」与「开始使用」位于同一操作区

### 其他
- 左上角音乐图标可点击打开 GitHub 仓库
## 0.29.2

- 修复宿主侧栏行在播放状态变化重渲染后覆盖 `mp-side-row` 类，导致控制按钮与波形再次跑到其他位置的问题；改为自动观察并恢复定位类

## 0.29.1

- 修复部分 DSH 布局下侧栏音乐入口的控制按钮与波形跑到侧栏/页面其他位置的问题：为宿主行补齐定位上下文，并在卸载时清理

## 0.29.0

### 播放页
- 新增「编辑播放页」：封面方形 / 黑胶、歌词排版、显示选项与恢复默认
- 新增播放页全屏
- 进度条波图：封面多特征色循环、双向对称、暂停淡出，改为 30fps
- 播放页背景改为 64×64 预模糊纹理，移除 110px 全屏 CSS 模糊
- 关闭播放页时停止波图与黑胶动画，入场结束后延迟启动，移除常驻 will-change
- 修复暂停 / 继续后波图分辨率变糊
- 恢复非当前歌词的渐进模糊
- 黑胶封面位置下移，倒影保留

### 输入框歌词
- 新增输入框上方歌词：固定音乐图标、纯文字、无胶囊背景
- 歌词切换改为固定视窗垂直滚动 + 上下渐隐，支持减少动态
- 新增输入框歌词开关与位置设置

### 在线与登录
- 扫码登录弹窗重新排版：头部、二维码、状态、步骤整体居中
- 状态胶囊改为内容自适应宽度，统一字号与间距
- 修复登录失败 / 过期时 `retry` 未定义导致弹窗崩溃
- 新增登录失效提示与重新登录 / 重试
- 在线歌单加载失败提示

### 其他
- 睡眠定时支持自定义分钟数
- 补充播放页、全屏、编辑面板、睡眠定时等文案与图标
- 统一播放页、输入框歌词与登录弹窗的 DSH token 用法

## 0.28.2

- 在线音乐新增专辑页：四个平台均可从歌曲专辑名进入并播放整张专辑
- 本地音乐支持点击专辑名进入该专辑歌曲列表
- 补充在线歌曲 albumId，支持网易云 / QQ / 酷狗 / 酷狗概念版专辑曲目
- 修复标准酷狗云歌单未读取 `albuminfo.name` 导致专辑名为空
- 窄布局下在歌手副标题补充可点击专辑名

## 0.28.1

- 侧栏音乐入口移除蓝点，新增实时音频频谱与上一首 / 播放暂停 / 下一首控制
- 频谱改用 AnalyserNode 真实频率数据，动态范围压缩后波动更明显；无有效波形时整段隐藏
- 频谱宽度扩到 42px，移除控制区背景框
- 播放器在本地与在线播放时都确保接入分析节点

## 0.28.0

### 界面
- 底栏与播放页进度条重做：3px 圆角细轨道、缓冲层、渐变填充、悬停变粗、常驻播放头
- 统计页首屏自动加载；修复排行封面未裁切导致整行错位
- 专辑 / 歌手 / 文件夹 / 歌单列表统一为 64px 行高、48px 封面、14px 标题
- 设置页为关闭按钮预留安全区，修复右上角内容与 × 重叠
- 缓存页明确区分「文件数」与「歌曲数」，避免 617 个文件被误解为 617 首歌
- 酷狗概念版歌单封面支持 {size} 占位符，恢复真实封面

### 账号
- 登录 / 登出时清理 profile、VIP 与歌单缓存，换号后不再显示旧账号昵称 / VIP
- QQ 头像恢复；QQ 与酷狗概念版显示账号 ID
- 批量播放跳过 VIP 曲目时明确提示数量

### 修复
- 本地喜欢接口返回对象数组导致列表为空、爱心无法点亮
- 空工具栏残留、导出清单缺失、统计首次打开为空

## 0.27.4

- 修复统计页排行封面未裁切导致整行被大图覆盖、文字错位
- 统计行封面固定为 28px 圆角缩略图

## 0.27.3

- 修复 package.json `exports` 缺少 `./package.json`，导致 DSH 无法定位客户端清单、侧边栏入口静默不加载

## 0.27.2

- 移除内容顶栏无内容的空工具栏，把整行高度让给歌曲列表
- 本地/在线列表在没有任何工具栏操作时直接贴近标题

## 0.27.1

- 同步远程 README / 图标 / 设置页响应式更新
- 保持 0.27.0 的队列、VIP、持久化与安全修复

## 0.27.0

### 稳定性与安全审计（本地测试，未发版）

- 收藏、歌单、统计、设置、登录态、播放状态改为原子写 + 备份 + 串行写
- 播放队列持久化支持在线歌曲元数据，状态请求体上限提升到 1 MB
- 队列打开状态收敛为单一来源，避免重复浮层
- 在线封面代理增加平台域名白名单，标签封面拒绝内网/本机地址
- 曲库扫描按真实路径去重，并显示 5000 首截断提示
- 队列列表增加拖拽排序
- 播放器增加跨窗口 leader 租约，避免多个窗口同时出声
- 回收站恢复校验原路径仍在音乐目录内
- 标签写入使用唯一临时文件，避免并发覆盖
- 新增原子存储与 URL 安全测试

### VIP 播放权限强制校验（本地测试，未发版）

- 客户端不再把 VIP 状态未知当作允许，只有明确 loggedIn + vip 才能请求 VIP 曲目
- Host /online/stream 增加服务端校验：VIP 曲目在取链和读缓存前检查账号权益，无权限返回 403 VIP_REQUIRED
- QQ VIP 探测改为多首曲目回退；酷狗普通版改用 union VIP 权益接口；覆盖四个平台

### 酷狗概念版独立平台（本地测试，未发版）

- 确认酷狗普通版与概念版会员是两套独立权益，普通版 token 无法播放概念版 VIP
- 新增第四个在线平台「酷狗概念版」（provider: kugouLite），与酷狗普通版独立登录、独立账号存储、独立签名与取链
- 顶栏、设置页、在线歌单、缓存、搜索与 VIP 判定均按四个平台分别处理

### 设置页响应式修复（本地测试，未发版）

- 设置行支持换行，避免平板/窄视口下文字与开关重叠
- 窄屏设置导航改为顶部横向滚动；设置面板使用动态视口高度
- 极窄屏设置行改为纵向排列，控件不再被压缩

## 0.26.0

### 音乐库设置重排

- 设置 → 音乐库改为卡片分区：音乐文件夹、扫描设置、回收站
- 顶部显示已扫描曲目数与扫描警告；重新扫描按钮移到文件夹卡片
- 文件夹行显示路径/显示状态，删除改为二次确认；添加行固定为输入 + 浏览 + 创建

### 平台账号资料 / 缓存歌曲列表

- 设置 → 在线：改用各平台 App Store 官方应用图标（256px WebP），并显示账号昵称、头像；NetEase/KuGou 实时读取资料，QQ 头像按 UIN 获取、昵称缺失时显示「QQ 音乐用户」
- 设置 → 缓存：新增全部平台缓存歌曲列表，显示标题、歌手、专辑、时长、大小与 LRC 标记

### 音量均衡状态 / 输入框歌词对齐

- 设置 → 播放显示状态：已生效 · 内置 EBU R128 / 未生效 · 浏览器不支持 Web Audio / 已关闭
- 输入框上方歌词条使用宿主的 composer side-clearance/card-max-width 变量，与输入框等宽对齐

### 歌单增量刷新与排序

- 在线歌单改为 stale-while-revalidate：刷新期间保留旧列表，按 id 合并，失败也不清空
- 喜欢/取消喜欢后乐观更新「我喜欢」计数，再后台校准
- 在线歌单排序：平台顺序 / 名称 / 歌曲数，可点击歌单组的排序按钮循环切换并持久化
- 歌单歌曲按 provider+id 缓存 60 秒，导航项 hover/focus 预取；切走再切回直接用缓存，过期时 stale-while-revalidate

### 关于页 / 音量均衡

- 设置新增「关于」：版本号、项目信息、作者、许可证、GitHub Issues / 源码 / npm 链接
- 设置 → 播放新增「音量均衡」开关（默认开）：按曲目 EBU R128 响度计算增益，避免切歌音量突变
- 改为浏览器内置 EBU R128：下载的音频 blob 用 `decodeAudioData` 解码，OfflineAudioContext 做 K 加权，按 BS.1770 门限计算 integrated LUFS
- 结果按 path + size 缓存在 localStorage；通过 Web Audio GainNode 应用增益，Web Audio 不可用时退化为元素音量衰减
- 不再需要 ffmpeg，也不再调用 Host 的 /music/loudness

## 0.25.6

- 顶栏「音乐」品牌标记换成用户提供的头像：30px 圆形、渐变描边、内嵌 128px WebP，不再使用通用音符块

## 0.25.5

- 插件图标替换为用户提供的头像（icon.svg，内嵌 256px PNG）
- VIP 判定改为按账号：/online/providers 返回各平台 vip（网易云账号 vipType、QQ detectVip、酷狗登录 token），有 VIP 才允许请求 VIP 曲目，无 VIP 直接提示，不再全放行/全拦截
- 在线缓存列表按当前平台过滤（磁盘本来已分平台存放）
- 酷狗喜欢优先使用 is_def=2 的「我喜欢」，没有时才回退默认收藏

## 0.25.4

- 喜欢图标改用本地 SVG 爱心，不再使用宿主的点赞（Like）图标
- 酷狗没有 `is_def=2` 的「我喜欢」时回退到默认收藏歌单，喜欢不再报「没有找到我喜欢」
- 云端喜欢/取消喜欢后自动刷新当前「我喜欢」歌单和歌单列表（行红心、右键、播放栏三个入口都接上）
- 队列按钮移到播放顺序旁，换成「列表 + 音符」的播放列表图标
- 底栏空白区域点击即可打开播放界面；按钮、进度条、音量、队列浮窗仍各自响应

## 0.25.3

- 客户端不再用 `qualityHint === VIP` 预过滤/拦截曲目，会员曲目全部交给 Host 带 Cookie 取链判定，避免登录态判断时序导致 VIP 账号仍被拦截

## 0.25.2

- 修复已登录会员仍被前端「VIP 曲目」拦截：登录态允许 VIP 曲目进入队列，由 Host 带 Cookie 取链判定，未登录仍提示会员
- 修复网易云 / QQ / 酷狗喜欢、取消喜欢、加入歌单提示「缺少 provider / song」：路由同时接受客户端轨道里的 `onlineId` 与 `id`
- 路由新增 `onlineSongId` 归一化与回归测试

## 0.25.1

- 行内喜欢按钮默认以 55% 透明度常显，悬停/已喜欢时增强，在线列表一眼可见

## 0.25.0

### 文件夹真实名称 / 缓存列表对齐歌单

- 文件夹视图改为按**绝对目录**聚合：标题显示目录名，下面小字显示完整路径，不再出现根目录统一显示「/」
- 点击文件夹按绝对目录过滤；兼容旧版本存下的相对 folder 过滤
- 在线播放时写入缓存元数据（标题/歌手/专辑/封面/时长）；缓存列表现在与普通歌单列表一致，有封面、歌手、专辑、时长
- 缓存位置说明：`cache/online/<provider>/<id>.audio` + `<id>.info.json` + `<id>.lyric.json`

## 0.24.1

- 列表勾选框增加右侧留白（margin-right 6px），不再贴边
- 在线歌曲列表恢复喜欢按钮：进入在线源时批量读取账号已喜欢的歌曲，行内红心可直接喜欢/取消，Host 新增 /online/liked-ids
- 在线搜索结果、歌单详情、缓存、最近播放共用同一份云端喜欢状态

## 0.24.0

### 底栏压缩 / 全宽进度 / 队列浮窗

- 播放栏高度 84 → 68px，封面 48 → 40px，播放键 40 → 36px，整体更紧凑
- 播放进度改为**贯穿整个底栏宽度**的顶部进度线，悬停加粗；当前/总时长移到右侧工具区
- 播放列表不再作为右侧栏，改为点击底栏队列按钮后在按钮旁弹出浮窗；侧栏队列布局移除
- 修复在线「缓存」tab 一直加载：effect 依赖 cachePhase 导致请求结果被 cleanup 丢弃，改为只在 nav / provider 变化时请求
- 设置面板固定 760×560（受视口限制），切换 tab 不再改变尺寸

## 0.23.0

### 多音乐目录 / 喜欢 / 在线云端操作

- 音乐库支持多个根目录；新增目录选择器（GET /browse），可从「文件夹」视图或设置页直接浏览添加
- 每个根目录可单独隐藏：设置 → 音乐库 的开关写入 hiddenRoots，扫描时跳过该目录
- 本地「很喜欢」统一改名为「喜欢」，爱心在喜欢后变为红色实心
- 在线歌曲右键支持云端「喜欢 / 取消喜欢」与「添加到歌单」，歌单列表来自账号云端
- 在线播放栏也显示喜欢按钮，状态来自账号
- 新增 Host 路由：/online/liked、/online/like、/online/playlist-add
- 在线右键保留「下一首播放」，并隐藏对在线歌曲无意义的本地路径操作

## 0.22.0

### 底部播放栏重做

- 高度 84px，三栏严格等分居中：信息左、控制中、工具右
- 48px 封面 + 播放态均衡器角标、悬停浮起与阴影
- 40px 主播放键、32px 工具按钮，统一 hover / active / focus 状态
- 进度条：4px 轨道、悬停加粗到 6px、悬停显示拇指；悬停时左侧时间直接预览目标时间（不遮挡播放键）
- 音量条改为中性色细轨，不再和进度条抢视觉
- 收藏按钮贴近歌曲信息，默认弱化、悬停/选中增强
- 空播放态使用 ghost 主按钮，避免一个不可用的黑色大按钮

## 0.21.0

### 歌单改为一级导航项

- 本地与在线都不再进入「歌单」列表页，每个歌单直接作为导航项（左栏 / 顶栏均支持）
- 本地歌单区标题旁提供「+ 新建」，右键歌单可删除；当前歌单高亮
- 在线播放列表在登录后自动加载为导航项，点击直接进入歌单详情，返回回到最近播放
- 旧状态里的 `nav: 'playlists'` 自动归位到歌曲 / 最近播放，避免落在空页面

## 0.20.1

### 选择逻辑修复

- 修复宿主菜单动作被面板自定义「点外部关闭」提前卸载的问题：全选、取消全选、播放/收藏等菜单项现在会真正执行
- 右键不再自动勾选被右键的行；只有右键已选中项才显示批量菜单，右键未选中项显示单项菜单
- 再次单击唯一已选项会退出多选，取消最后一项也会退出，避免「看不见但仍处于多选」的状态
- 取消全选会清空并退出多选

## 0.20.0

### 多选操作收进右键菜单

- 顶栏不再保留选择操作区（全选 / 取消 / 完成 / 播放选中 / 收藏 / 添加 / 批量 / 删除）
- 已选数量显示在标题旁，避免工具栏跳动
- 右键菜单在选中状态下直接对选中集合操作：播放 / 收藏 / 添加歌单 / 批量编辑 / 删除，并附带全选 / 取消全选 / 完成
- 右键未选中的行会先把它加入选择，再执行批量操作
- Esc 可退出多选；在线页同样收敛为「标题旁数量 + 右键批量」
- 播放全部保留为唯一的全量播放入口，不再与播放选中并排

## 0.19.0

### 只保留列表视图

- 移除歌曲「封面墙 / 网格视图」切换与 `TrackGrid` / `TrackCard` 组件
- 专辑页从卡片网格改为列表行，与歌手/文件夹一致
- 旧配置里的 `viewMode: 'grid'` 会被忽略，统一按列表渲染
- 清理网格相关样式、文案、图标与截图；测试改为验证旧配置兼容

## 0.18.2

### 交互审计与修复

- 修复宿主 Modal 与面板全局 Esc 的双关闭：Esc 交给宿主时不再二次 popLayer
- 区域选择支持 Esc 取消
- 播放页 Aa 设置浮层支持点外部关闭与 Escape
- 单曲循环不再误高亮「列表循环」胶囊
- 标签保存后自动恢复原播放状态（用户已手动恢复则不重复 toggle）
- 新增 docs/界面交互审计-2026-11.md：Tab 顺序、选择工具栏换行、网格未虚拟化、搜索未防抖、缓存清理入口等后续项

## 0.18.1

### 规范固化

- 新增 docs/主题与组件开发规范.md：token 速查、组件规则、宿主适配层、反例、验证清单
- README 增加「主题与组件规范」入口
- 新增 	est/theme.test.mjs 守卫：圆角只允许 8/12/16/20、字号只允许 13/12/11、禁止旧蓝色与旧 token、宿主包只能在适配层 require、对话框必须走 KitModal
- 修复设置页在线提示剩余的 11.5px 内联字号

## 0.18.0

### 宿主组件（收尾）

- 全部对话框改用宿主 Modal：加入歌单、登录、标签编辑、批量编辑、重复清理、在线歌词、回收站、确认框
- 设置面板改为宿主 Modal（headless）：保留原两栏布局，但获得焦点陷阱与 Escape 关闭
- 通用图标改用宿主 Icon*：搜索、设置、加号、删除、用户、刷新、播放/暂停、信息、警告、下载、编辑、复制、时钟、文件夹、勾选、关闭、更多、箭头、排序、喜欢、队列
- 音乐专属图标（上一首/下一首/随机/循环/音量/音符）保留本地 SVG

## 0.17.0

### 宿主组件（第三批）

- 右键菜单改用宿主 Menu（contextual + 指针锚点）：原生定位/翻转、键盘导航、Escape、点外部关闭
- Toast 改用宿主 Toast：portal 到底部、原生样式与停留时间
- 回收站对话框改用宿主 Modal：焦点陷阱、Escape、原生标题/关闭

## 0.16.2

### 宿主组件（第二批）

- 顶栏「选择 / 排序」菜单改用宿主 Menu：原生定位、键盘导航、Escape/外部点击关闭、选中勾、portal
- 回退路径保留原有自绘菜单，测试与无宿主环境不受影响

## 0.16.1

### 诊断

- 设置 → 外观 底部新增「宿主组件」状态行：
ative 表示正在使用 DSH 官方组件，allback 表示本地回退；无需打开 DevTools 即可确认

## 0.16.0

### 接入宿主组件（第一批）

- 新增可选适配层：equire('@deepseek-ai/dsh-client-ui-primitives') 可用时使用宿主组件，缺失时自动回退到原有实现
- 已切换：**Switch**、**Pill**（播放模式胶囊）、**Tooltip**（所有图标按钮）、**Modal**（确认对话框）
- 主按钮改用官方单色 --dsw-alias-button-primary-fill（浅色近黑 / 深色近白）
- 启动时在控制台输出 [dsh-music-panel] host UI kit: native|fallback，便于确认实际走的是哪条路径

## 0.15.0

### 主题对齐 DSH 官方

- 颜色全部走官方 --dsw-* token：背景层、标签、边框、交互 hover/active、菜单材质、toast；主按钮改用官方单色 primary（浅色近黑 / 深色近白）
- 圆角改为官方尺度 **8 / 12 / 16 / 20**；正文 13px / 12px / 11px 文本阶
- 焦点环统一为官方 2px --dsw-focus-ring-color（浅色 #4176E6 / 深色 #7AAAFF）
- 菜单与弹层使用 --dsw-menu-surface-fill + --dsw-menu-backdrop-filter + --dsw-elevation-panel；模态遮罩改为官方的不模糊黑色半透明
- 修复浅色模式下封面占位图标不可见（原先写死白色）

## 0.14.0

### 顶栏重构（本地 / 在线共用）

- 标题 + 数量在左，右侧三个图标：**选择菜单**（全部选择 / 全部取消 / 区域选择 / 反向选择）、**排序菜单**（字段 + 升降序）、**搜索**（聚焦顶部搜索框）
- 第二行统一为播放模式胶囊：**列表循环 / 顺序播放 / 随机播放**，当前模式高亮，点击即切换播放器顺序
- 「播放全部」移到工具栏最右侧，保持可用但不抢占模式胶囊的位置
- 区域选择：选菜单后先点起点、再点终点；在线视图同样支持选择（播放选中）与排序

### 修复

- 本地列表的排序 / 视图入口收敛到顶栏菜单与工具栏，避免两套排序控件

## 0.13.3

### 交互

- 选中框位置回到旧版：列表在**行尾**（时长与收藏之后），封面墙在**封面左上角**
- 选中框不再常驻：默认透明，只有悬停该行 / 已选中（或键盘聚焦）才显示
- 列表进入选择模式时，行尾的「更多」按钮让位给选中框；右键菜单仍然可用

## 0.13.2

### 交互

- 列表与封面墙恢复旧版操作：**单击选中、双击播放**；封面上的播放按钮仍可单击直接播放
- 进入选择模式后，单击会替换为单选，勾选圈或 Ctrl / Cmd + 单击才是累加；再点同一条取消选择
- 双击时忽略第二次 click，避免播放前把选中状态清掉

## 0.13.1

### 修复

- 内容区标题上方多余空白：标题栏固定预留 88px（min-height:62 + 上下 padding，标题又被底部对齐），现在收紧到 46px，封面墙 / 列表都少了一段空带

## 0.13.0

### 补齐

- **在线匹配单字段应用**：点整行应用全部字段，点结果下方的字段胶囊（标题 / 歌手 / 专辑 / 年份 / 音轨号 / 碟号 / 封面）只应用该字段
- **回收站恢复**：GET /music/trash 列出被移除的曲目，POST /music/trash/restore 按原路径还原；设置 → 音乐库 → 回收站 可直接恢复，重名自动加  (restored)
- **睡眠定时剩余时间**：设置里显示剩余并可直接取消；播放条右侧常驻倒计时胶囊，点一下取消
- **封面墙多选**：网格视图支持勾选，与列表共用同一套选择状态与批量操作

### 修复

- 网格视图勾选状态未生效（selectedSet 取值错误）
- 回收站路由在缺少 settings.dir 的测试环境下报错

## 0.12.1

### 补齐重构期暂缓的功能

- **多选与批量操作**：列表工具栏「多选」，全选 / 取消全选 / 完成，播放选中、收藏选中、加入歌单、批量编辑元数据、删除（移入回收站）
- **标签编辑增强**：在线匹配（网易云 / QQ / iTunes / MusicBrainz）、封面预览与替换、补齐专辑艺术家 / 音轨号 / 碟号 / 作曲 / 作词 / 注释
- **在线歌词**：搜索候选、预览、应用；标签编辑器与播放页（写回文件）均可使用
- **歌词偏移**：播放页 Aa 内 ±0.5s 微调，可一键写回文件
- **重复清理**：按标题 + 艺术家 + 时长分组，保留音质最好的一条，其余移入回收站
- **睡眠定时**：设置 → 播放，15 / 30 / 60 / 90 分钟后自动暂停

### 修复

- 标签对话框内容被 flex 压缩、输入框横向溢出的布局问题
- 多选时封面上的播放角标挡住勾选框
- 播放条空状态提示文案
- 设置页若干行标签错位（启动恢复 / 自动播放 / 每首记忆 / 歌词顺序 / 文件夹深度），补齐「歌词对齐」设置

## 0.12.0

### 重构（界面 v2）

- **全新骨架**：顶栏 / 内容 / 队列侧栏；内容区是唯一主滚动容器，顶栏、分区栏、播放条固定
- **布局可切换**：设置 → 外观 → 布局，可在「顶栏分区」与「左侧导航」之间切换（不再与 DSH 自带侧栏重复）
- **导航模型统一**：来源在顶栏，分区（歌曲/专辑/歌手/文件夹/很喜欢/歌单/统计 或 最近播放/我的歌单/缓存）在分区栏或左栏；本地与在线共用同一套
- **唯一搜索框**：作用域跟随来源；本地即时过滤，在线回车搜索
- **队列改为侧栏**：不再覆盖内容，也不和播放页抢层级；窄屏自动收起
- **统一浮层栈**：菜单 / 对话框 / 设置页 / 播放页按固定层级叠加，Esc 逐层关闭
- **统一行组件**：本地、在线、队列、统计共用一种行；虚拟列表覆盖所有列表视图
- **滚动与定位**：滚动位置按视图记忆；定位正在播放改用列表 focusPath，不再查 DOM + setTimeout
- **音量恢复**：播放条提供音量与静音，修复挂载时把音量重置为 1 的问题
- **设置整页化**：外观 / 歌词 / 播放 / 在线 / 音乐库 / 缓存 六个分页，单一滚动
- **播放页回归 0.11 视觉**：圆形/方形封面与黑胶环、模糊封面背景、居中标题、Aa 歌词设置浮层、浮动控制条（含采样率）

### 变更

- client.js 改为由 src/ 分片构建生成（
ode scripts/build-client.mjs），构建脚本检测重复顶层声明
- 偏好迁移到 music.prefs.v2、界面状态迁移到 music.ui.v2；旧键 dsh-music.prefs、mu.source、mu.view 自动迁移
- 移除侧栏悬浮播放控制与 mini player；输入框集群保留播放/暂停与队列入口

### 暂未迁移（下一版）

- 标签的在线匹配、封面替换、批量编辑、重复清理
- 在线歌词搜索与写回、睡眠定时
- 多选与批量操作

## 0.11.1

### 新增

- 本地歌曲行在**缺元数据**（标题或艺术家为空）时显示「在线匹配」快捷按钮：点击直接打开元数据编辑并**自动发起在线匹配**，不用再右键一层层找入口

## 0.11.0

### 新增

- **本地音乐按文件夹分组**：新增「文件夹」视图，自动把曲库按目录聚合（相对扫描根目录显示路径），点文件夹进入该目录的歌曲列表；标题行显示文件夹过滤条件，可一键清除

## 0.10.4

### 优化

- 歌单横条更精致：选中态改为**内描边 + 柔光**（不会再被横向滚动容器裁掉）、卡片悬停轻微上浮、名称加粗、间距与圆角调整

## 0.10.3

### 重构（阶段 4：清理）

- 移除废弃的 `onlineMode` / `onlineOpenedPlaylists` 状态与不再调用的 `loadMyPlaylists`
- 删除旧歌单模式相关的废弃样式（`mu-online-modes` / `mu-online-tab` / `mu-online-playlist-chip` / `mu-online-history` 等 8 组）
- 定位按钮的滚动选择器改指向新的内容区容器

## 0.10.2

### 重构（阶段 3：浮层层级）

- 播放页 z-index 提升为面板内最高（80），不再被其他面板元素遮挡
- 播放页内「播放队列」改为**直接打开队列浮层**（队列在独立宿主座位、层级更高），不需要先退出播放页

## 0.10.1

### 重构（阶段 2：本地视图头部）

- 本地各视图（歌曲 / 专辑 / 艺术家 / 喜欢 / 统计 / 歌单）新增统一标题行：左侧视图名、右侧曲目数，与在线视图视觉对齐

## 0.10.0

### 重构（阶段 1：在线视图）

- 在线界面按原型重建：**搜索行 → 常驻歌单横条（Tab 栏）→ 内容区**
- 歌单横条始终保留：点击歌单**只替换下方内容区**（标题变为歌单名、列表变为该歌单曲目），卡片高亮
- 横条第一项是「最近播放」，点击切回历史列表
- 搜索结果独立显示，内容区标题变为「搜索结果」，右侧按钮可回到最近播放
- 移除旧的「搜索 / 我的歌单」模式切换与二级页面逻辑

## 0.9.36

### 变更

- 歌单不再新增标签栏：点击歌单卡片后，内容区直接切换为该歌单的曲目，标题行显示歌单名与「← 最近播放」返回按钮

### 修复

- 右下角定位按钮的位置：改为面板级定位（底栏上方），不再压在播放控制条上

## 0.9.35

### 变更

- 歌单改为 **tab** 形式：点击歌单卡片后，歌单作为标签出现在「最近播放」旁边，点击 tab 切换内容，不再进入独立的歌单页
- 已打开的歌单 tab 会保留（最多 8 个），再次点击卡片只会切换并刷新

## 0.9.34

### 变更

- 移除「搜索 / 我的歌单」子 tab 与「我的歌单」列表页：歌单统一通过「最近播放」上方的常驻横条访问
- 点击歌单卡片直接显示该歌单的曲目，左上角「返回」回到最近播放

## 0.9.33

### 修复

- 右下角出现两个定位按钮：移除在线视图里重复的那个，全局只保留一个
- 点击「我的歌单」卡片无法打开：现在点击时先切到歌单模式再加载曲目

### 变更

- 歌单横条移到「最近播放」上方，去掉标题与「查看全部」按钮
- 歌单卡片缩小到 64px，间距收紧，整体更紧凑

## 0.9.32

### 变更

- 在线面板的「我的歌单」改为**常驻显示**：最近播放下方直接展示歌单横条（前 8 个），点击即可进入；标题右侧「查看全部」打开完整歌单列表
- 打开在线面板时静默预加载歌单，不需要先切到「我的歌单」二级页面

## 0.9.31

### 变更

- 「定位到正在播放」支持**跨列表跳转**：在其他 tab 点击时，会先切到正在播放歌曲所属的列表（对应在线平台 / 本地歌曲），再滚动到该行；不再直接提示「没有正在播放」
- 本地音乐 tab 也新增右下角浮动定位按钮

## 0.9.30

### 新增

- 「最近播放」支持**右键单曲移除**：右键 → 从最近播放中移除

### 修复

- 切换会话再回到音乐插件时，保留上次打开的 tab（歌曲 / 专辑 / 歌手 / 收藏 / 统计 / 歌单 / 在线）与来源平台（本地 / 网易云 / QQ / 酷狗）

## 0.9.29

### 变更

- 「定位到正在播放」按钮改为**右下角浮动圆形按钮**（仅在播放时显示）；「清除无法播放的歌曲」仍留在最近播放标题行

## 0.9.28

### 新增

- 在线「最近播放」列表头部新增两个按钮：
  - **定位到正在播放**：一键滚动到当前播放的歌曲行
  - **清除无法播放的歌曲**：批量检测历史曲目的可播性，移除 VIP / 已下架的条目（Host 新增 `/online/check-playable`）

## 0.9.27

### 修复

- **网易云 / 酷狗拖动进度条回到开头**：Desktop（Electron）媒体栈会对本插件 HTTP 流上的 `currentTime` 写入静默丢弃，seek 直接重播；本地文件因为走 blob 所以正常（QQ 往往是已缓存的歌，因此也没事）。在线曲目现在也**先取整首到 blob 再播放**（缓存命中时是本地读，几乎瞬间），seek 行为与本地一致；预取失败时回退到流式播放

## 0.9.26

### 修复

- **拖动进度条回到开头（网易云 / 酷狗）**：Chromium 把「带 Range 的请求返回 200」视为服务器不支持分段，拖动时强制从 0 重新加载。现在所有 Range 请求（包括 `bytes=0-`）都转发给上游并返回 `206 Partial Content`，`bytes=0-` 的完整 206 仍会写入缓存

## 0.9.25

### 修复

- **网易云 / 酷狗拖动进度条会重新播放**：代理响应此前透传上游缺失的 `accept-ranges`（被设成 `none`），浏览器因此拒绝 seek 并重新加载。现在始终声明 `accept-ranges: bytes`（缓存命中本地切片，未命中转发 Range 给上游）；QQ 的上游本来就带这个头，所以一直正常

## 0.9.24

### 变更

- 已缓存标记由绿点改为**下载图标**（SVG），缓存完成后显示

## 0.9.23

### 变更

- 底栏移除在线音质标签（音质已统一为标准，不再展示）

## 0.9.22

### 变更

- 在线音质统一为「标准」，移除高音质 / 无损选项

### 新增

- 播放队列头部新增「定位到当前播放」按钮，一键滚动到正在播放的歌曲

### 修复

- **歌词翻译对 QQ / 酷狗无效**：
  - QQ：翻译不在 `fcg_query_lyric_new` 的 `trans` 字段（该字段恒为空），而在 `GetPlayLyricInfo` 的加密 `data.trans`；现已解密解析（实测 Lemon 57 行中文翻译）
  - 酷狗：普通 LRC 不含翻译，翻译在 KRC 流里；现已接入 `getWordLines` 的 `translations`（实测 Lemon 54 行）
  - 网易云一直有效（接口自带 `trans`）

## 0.9.21

### 修复

- **已缓存绿点切换页面后消失**：缓存状态合并改为「true 不会被旧的 false 覆盖」；切换来源时作废进行中的搜索请求，避免旧响应用错的平台数据覆盖；页面刷新后历史列表也会重新查询缓存状态
- 删除单首缓存后，列表里的绿点同步消失

## 0.9.20

### 变更

- 「已缓存」文字标记改为**小绿点**（悬停显示提示）

### 新增

- 设置 → 在线：新增**缓存列表**，展示每首已缓存歌曲（标题 / 艺术家 / 大小 / 是否含歌词），支持单首删除
- 播放在线歌曲时写入歌曲元数据（标题/艺术家/专辑/封面地址），供缓存列表展示

## 0.9.19

### 修复

- **音频缓存一直不生效**：Chromium 播放器会用 `Range: bytes=0-` 探测媒体，之前被当成 seek 请求而跳过缓存。现在把「从头开始」的 Range 当完整请求处理，首次播放即可缓存
- 播放中断时的临时文件现在会被正确删除（不再残留 `.tmp`）
- 清空缓存会一并清理残留的临时文件

## 0.9.18

### 变更

- 音频缓存改为**流式落盘**：边播边写临时文件，播放结束后重命名（不再把整首缓存在内存里，无损大文件也更稳）

### 新增

- 搜索结果 / 歌单里已缓存的曲目显示绿色「已缓存」标记
- 播放时底栏显示缓存进度（如「缓存中 45%」），完成后显示「已缓存」

## 0.9.17

### 修复

- 缓存完整性：只有完整下载的音频才写入缓存（切歌、中断、超限的流不再保存半截文件，避免下次播放损坏）

## 0.9.16

### 修复

- 播放页内「播放队列」按钮没反应：点击后先收起全屏播放页，再打开队列浮层（之前浮层被播放页遮住）

## 0.9.15

### 新增

- 底栏显示在线曲目的实际音质徽标（如「在线 · 320k」/「在线 · 无损」）

### 修复

- 在线播放失败时给出提示（之前会静默跳到下一首）
- 登录过期（20017 / 20018 / 未登录）统一提示「登录已过期，请重新登录」

## 0.9.14

### 优化

- 在线搜索 / 歌单请求增加竞态保护：快速切换平台或连续搜索时，旧响应不会覆盖新结果
- 网络错误显示友好提示（不再直接抛原始 fetch 错误）
- 在线取链失败自动重试一次（应对网络抖动）
- 搜索结果最多渲染 200 条（酷狗一次返回 480 条时更流畅），队列仍包含全部可播曲目

## 0.9.13

### 变更

- 在线缓存上限默认提升到 **10 GB**（超出仍按最近使用时间清理）

### 新增

- 缓存范围扩展到**歌词与封面**：在线歌词（LRC + 翻译）、经 Host 代理的封面图片都会落盘；再次播放同一首不再请求平台
- 设置 → 在线的缓存统计显示总项数与体积（音频 / 歌词 / 封面合计）

## 0.9.12

### 新增

- **在线音频缓存**：播放过的曲目存到 `<DSH_HOME>/music/cache/online/`，下次播放直接读本地（支持拖动），不再消耗网络；默认上限 2 GB，超出按最近使用时间清理
- 设置 → 在线：显示缓存大小 / 曲目数，可刷新或清空
- **音质选择**：标准 / 高音质 / 无损；网易云、QQ、酷狗取链按偏好顺序请求，服务端按账号权限授予
- 首次播放会完整下载一次写入缓存；拖动进度条产生的分段请求不写入缓存

## 0.9.11

### 变更

- 播放在线歌曲时，播放列表（队列）同步为当前列表（搜索结果 / 歌单歌曲 / 历史），并从所点曲目开始
- 队列只收可播放曲目：VIP / 付费曲自动过滤；点到 VIP 曲目会提示需要会员
- Agent 在线播放同样只把可播曲目加入队列

## 0.9.10

### 修复

- QQ 歌单歌曲没有封面和时长：歌单接口不返回 `albummid` / `interval`，现在补上（封面走 `y.gtimg.cn`，时长正常显示）
- 在线来源页不再显示本地工具栏（随机播放 / 播放全部 / 视图 / 队列）
- 在线面板的「← 返回」移到左侧，非 VIP 曲目不再重复显示平台名徽标

## 0.9.9

### 修复

- 酷狗 VIP / 付费标不显示：判断改为 `payType > 0 || privilege > 0`（与参考实现一致）
- QQ 封面不显示：新增 Host 图片代理兜底，直链被平台防盗链拦截时自动改走 `/music/online/cover`（仅允许平台域名）

## 0.9.8

### 修复

- 酷狗「我的歌单」点开为空：我的歌单 id 是云歌单 `listid`（不是公开 `specialid`），改用 `get_list_all_file` 读取；收藏歌单用 `get_other_list_file_nofilt`
- QQ 搜索结果没有封面：补充专辑 `albummid`，用 `y.gtimg.cn` 专辑封面地址
- 酷狗收藏歌单读取失败时的回退逻辑

### 说明

- QQ / 酷狗的 VIP / 付费曲取链为空属正常（需要对应会员），免费曲三平台均可播放

## 0.9.7

### 变更

- 在线平台面板搜索框常驻显示：「我的歌单」页也能直接搜索，聚焦或回车会自动切到搜索页
- 主面板顶部搜索框默认展开

## 0.9.6

### 变更

- 在线平台面板：没有历史播放时默认打开「我的歌单」；有历史时显示「最近播放」
- 未登录或歌单读取失败时，面板内直接显示登录按钮（QQ 同时提供微信 / QQ 两种登录），登录成功后自动刷新歌单

## 0.9.5

### 新增

- 在线平台面板打开时显示「最近播放」历史（按平台分开、最多 50 条、保存在本机）
- VIP 曲目徽标改为金色，便于快速识别

### 修复

- 「我的歌单」按钮有时失灵：现在每次点击都会重新加载（之前已在该页时点击无效）
- 在线歌曲拖动进度条会从头播放：代理流现在透传浏览器的 `Range` 请求（正确处理 206/416）

## 0.9.4

### 修复

- QQ 音乐取链：登录改为支持两种方式（微信扫码 / QQ 扫码），设置页 QQ 行提供两个入口；QQ 扫码的 musickey 在部分曲目取链为空时改用微信登录（与参考实现一致）
- 酷狗取链：登录前先执行设备注册（`r_register_dev`），取链使用注册后的 `dfid`；VIP/付费曲返回明确提示，不再出现 `error_code=NaN`
- 酷狗歌词为空：`getLyric` 改为对象参数（`{ hash }`），现在能正常返回 LRC

### 说明

- 免费曲三个平台都可播放；标有 VIP/付费的曲目需要对应平台的会员账号
- 若某首歌提示付费/会员，换一首免费曲即可验证链路

## 0.9.3

### 变更

- 顶栏按歌曲源分组：**本地音乐 / 网易云 / QQ 音乐 / 酷狗**；「全部歌曲」更名为「本地歌曲」
- 本地来源内保留子标签：本地歌曲 / 我喜欢 / 统计 / 专辑 / 艺术家 / 自建歌单
- 在线来源内部子标签：搜索 / 我的歌单，平台由顶栏来源决定（不再重复选平台）
- 本地音乐支持**多个文件夹叠加**：设置 → 文件夹 可添加 / 移除多个目录，扫描结果合并为同一曲库

## 0.9.2

### 修复

- 在线歌曲无法播放（代理流 502）：响应头 `x-music-quality` 带中文，Node 拒绝非 ASCII 头导致流中断；移除该头
- 在线曲目播放页无封面：播放页背景与大封面改用曲目的平台封面 URL（`track.coverUrl`）
- 在线歌词在播放页 / 输入框歌词条正常拉取平台 LRC（含翻译）

### 新增

- 在线「我的歌单」：登录后可查看各平台账号的歌单与歌曲并直接播放（网易云 / QQ / 酷狗）

## 0.9.1

### 修复

- **插件整体加载失败**（`/music/*` 全部 404、面板异常）：0.8.2 / 0.9.0 使用了不存在的 `ctx.inject(deps, callback)`，改为 `ctx.get('tools')` / `ctx.get('systemPrompt')` 可选获取，服务缺失时跳过而不影响插件加载
- 在线登录二维码弹窗“闪一下就消失”：出码失败时保留弹窗并显示错误信息，不再立即关闭

## 0.9.0

### 新增

- 在线音乐：主面板「在线」视图，支持网易云 / QQ 音乐 / 酷狗搜索与播放（Host 取链 + 同源代理流，Range 透传）
- 设置 → 在线：三平台扫码登录（二维码 + 轮询状态），登录态保存在 `<DSH_HOME>/music/providers.json`（0600）
- 在线歌词：播放在线曲目时自动拉取平台 LRC（含翻译）
- Agent：`music_control` 新增 `source`（netease / qq / kugou），模型可直接在线搜索并播放
- 平台模块移植自 [kendu76/dsh-music-player](https://github.com/kendu76/dsh-music-player)（MIT，见 `lib/providers/LICENSE`）

### 说明

- 未登录只播放免费曲目；QQ / 酷狗的高音质需扫码登录
- 在线接口为非官方接口，可能失效；失败只在在线视图提示，不影响本地库
- 仅流式播放，不下载、不批量抓取

## 0.8.3

### 修复

- 专辑 / 艺术家视图无法上下滚动：补上 `flex:1`、`min-height:0` 与 `overflow-y:auto`，与歌曲列表 / 网格保持一致

## 0.8.2

### 新增

- **Agent 控制**：注册 Host 工具 `music_control`（play / pause / next / previous），模型可在对话里直接控制音乐
- Host 侧维护一个短队列（最多 10 条），打开的播放面板每 2 秒拉取并执行；`play` 支持按歌名或艺术家匹配曲库
- 新增 `GET /music/control/pending` 接口

### 说明

- 浏览器自动播放策略可能阻止“未交互时”的自动播放，先播过一次后即正常

## 0.8.1

### 新增

- 批量编辑：多选歌曲后可一次性修改艺术家、专辑、风格、专辑艺术家（留空保持原值），逐首合并后写回标签

## 0.8.0

### 新增

- 专辑视图：按专辑聚合的封面墙，卡片显示封面、专辑名、艺术家与曲目数，点击查看该专辑曲目
- 艺术家视图：按艺术家聚合的列表（按曲目数排序），点击查看该艺术家曲目
- 筛选条：显示当前专辑 / 艺术家过滤条件，可一键清除

## 0.7.7

### 变更

- 引导弹窗里的「选择文件夹」改为**内嵌目录浏览**：直接在弹窗内选目录，不再弹出会被引导遮住的独立窗口
- 选中目录后自动添加文件夹并进入下一步；引导弹窗限高并支持内部滚动

## 0.7.6

### 变更

- 统计页列表完全复用歌单行样式：同样的五列 grid、行高、60px 封面、标题/副标题/右列排版；统计时长、播放次数、最近播放映射到原有列，去掉排名列与自定义列宽

## 0.7.5

### 变更

- 统计页列表与歌单列表统一：相同的行高、封面尺寸与间距
- 统计页列表支持操作：双击播放、封面按钮播放、右键菜单（与歌曲列表同一套菜单）
- 当前播放的歌曲在统计页高亮

## 0.7.4

### 变更

- 统计页视觉重做：筛选改为三组分段控件，汇总卡加图标与渐变背景、数值放大，排行榜前三名金银铜配色，列表加容器、行 hover 与更大封面

## 0.7.3

### 修复

- 引导弹窗按钮点不动：外层遮罩层是 `pointer-events: none`，弹窗本身缺少 `pointer-events: auto`

## 0.7.2

### 新增

- 设置面板标签栏右侧新增「? 查看使用引导」按钮：关闭设置并重新打开引导，误关弹窗后也能找回教程

## 0.7.1

### 修复

- 首次使用引导弹窗改为屏幕居中显示（`position: fixed` + translate(-50%, -50%)）

## 0.7.0

### 新增

- 首次使用引导：第一次打开音乐面板时显示 3 步欢迎引导（添加文件夹 / 双击播放 / 元数据与歌词），可跳过
- 空状态提供「查看使用引导」，随时可以重新打开

## 0.6.7

### 变更

- 在线元数据匹配与在线歌词搜索：优先用标题搜索，标题为空时回退到**文件名（去扩展名）**，不再用空标题搜索

## 0.6.6

### 变更

- 空曲库页面直接提供「添加音乐文件夹」按钮：点击弹出文件夹选择器，选中后立即保存并自动扫描，不用再去设置里找
- 文件夹选择器从设置面板改为独立弹窗（空状态与设置页共用同一套界面）

## 0.6.5

### 修复

- 呼出播放列表面板瞬间在右下角闪一下：锚点位置改为**渲染时同步计算**，首次绘制就出现在按钮旁，不再等 `useEffect` 后再跳位；窗口 resize 时仍会重新计算

## 0.6.4

### 修复

- 播放列表面板改为**锚定在触发按钮旁边**弹出：打开时读取按钮的 `getBoundingClientRect()`，面板底边贴着按钮上边缘、右边缘与按钮右边缘对齐（并 clamp 在视口内），不再固定右下角

## 0.6.3

### 变更

- 播放列表面板不再支持自由拖动：取消面板拖动与位置记忆，固定从右下角（队列按钮上方）弹出

## 0.6.2

### 修复

- 在线歌词弹窗被元数据编辑弹窗（z-index 94）遮住无法点击：改为 `position: fixed` + `z-index: 120`，始终浮在最上层

## 0.6.1

### 变更

- 在线歌词改为写入**内嵌歌词**（与编辑元数据一致）：MP3 ID3 USLT / FLAC Vorbis LYRICS，写前自动备份 `<文件>.lyrics.bak`，不再只写 `.lrc`
- 元数据编辑弹窗的歌词区新增「在线歌词」按钮：可单独搜索歌词并回填到歌词字段，保存元数据时一并写入内嵌

## 0.6.0

### 新增

- 在线歌词搜索（与元数据在线匹配同一套流程）：播放页歌词设置里点「在线歌词」→ 按歌名/艺术家搜索 → 选中候选预览歌词 → 保存为同目录 `.lrc` 文件
- 新增 `GET /music/lyrics/search`、`GET /music/lyrics/fetch`、`POST /music/lyrics/save` 路由；保存仅允许写入已配置音乐目录内的 `.lrc`

### 说明

- 歌词来源为网易云，与在线元数据匹配一样属于非官方接口，可能失效

## 0.5.11

### 变更

- 输入框上方歌词条左侧只显示歌名（去掉艺术家与文件名），字号 14px 与歌词一致

## 0.5.10

### 变更

- 输入框上方歌词条的频谱加长：64px → 104px，条数 18 → 28

## 0.5.9

### 变更

- 输入框上方歌词条改为自适应 flex 布局：歌名按内容宽度、波形紧跟歌名（不再固定居中）、歌词占剩余空间并右对齐；歌名短时波形偏左，歌词长时优先保证歌词显示
- 去掉歌词右侧渐隐遮罩，超长时用省略号；窄窗口（≤760px）自动隐藏波形

## 0.5.8

### 变更

- 输入框上方歌词条改为三列布局：歌名左对齐、中间实时频谱、歌词右对齐

## 0.5.7

### 变更

- 重复歌曲清理改为按音质保留：码率 → 采样率 → 文件大小依次比较，保留音质最好的一首
- 重复弹窗每行显示码率、采样率与文件大小，方便核对保留结果

## 0.5.6

### 新增

- 重复歌曲清理：重复弹窗新增「删除重复（保留最大）」，每组保留文件最大的那首，其余移到插件回收站 `<DSH_HOME>/music/trash/`（可恢复）
- 新增 `POST /music/remove` 路由，仅允许移动已配置音乐目录内的文件

### 说明

- 清理是移动到回收站，不是永久删除；需要恢复时从 trash 目录手动取回

## 0.5.5

### 新增

- 播放设置页补全（启动恢复、自动播放、每首歌记住位置），并新增睡眠定时（15 / 30 / 60 / 90 分钟，到点自动暂停）
- 批量收藏：多选后一键收藏选中歌曲
- 重复歌曲检测：标题、艺术家与时长相同的曲目显示「重复 N 组」，点开可查看每组的文件路径与大小

### 修复

- 设置面板「播放」标签页此前是空白（内容缺失），现已补全

## 0.5.4

### 回退

- 整体回退到 0.3.45 的代码与行为：撤销 0.4.x 的在线音乐源、0.5.x 的 P1/P2 改动（播放设置页、睡眠定时、淡入淡出、批量收藏、歌词导出、快捷键、重复检测、Issue 模板、减少动态效果适配）
- 保留 0.3.45 之后的版本号纪律：本版本内容等同 0.3.45

## 0.3.45

### 变更

- 播放页呼出/收起过渡加快 20%：0.4s → 0.32s，关闭卸载延迟同步调整为 340ms；底栏淡出 0.25s → 0.2s

## 0.3.44

### 修复

- 网格视图爱心不亮、点击像没反应：收藏数据是对象数组（`{ path }`），网格与播放页误用 `indexOf(path)` 判断，结果永远为未收藏；改为与列表一致的路径映射 / `some` 判断，点击后爱心会立即切换并持久保存

## 0.3.43

### 变更

- 统一播放页底栏与常驻底栏的控制按钮：循环、上一首、播放/暂停、下一首、队列，顺序、尺寸（36px 播放键、17/18/20 图标）与 4px 间距完全一致
- 播放页底栏右侧补齐采样率胶囊与收藏爱心，收藏状态与歌曲列表同步
- 播放页的播放控制按钮同样会初始化频谱分析器（与底栏行为一致）

## 0.3.42

### 变更

- 播放页切换按 YesPlayMusic 源码的 `.slide-up` 过渡实现：`transform: translateY(100%)` + `transition: transform .4s ease`，挂载两帧后加 `is-open` 上滑；关闭时移除类、420ms 后卸载
- 底栏在播放页打开时淡出上移（`.is-bar-hidden`），关闭时恢复

### 修复

- 移除 0.3.38–0.3.41 中基于 WAAPI / 测量 / 克隆的过渡代码，动画时序和错位问题一并消除

## 0.3.41

### 变更

- 播放页切换改为成熟上滑方案（Spotify / YesPlayMusic / YouTube Music 同类做法）：全屏播放页从底部整页滑入，底栏同步淡出下沉；关闭时下滑退出
- 移除共享封面/克隆/坐标测量逻辑，彻底消除错位风险；动画只动 `transform/opacity`
- `.mu-root` 增加裁剪，滑入过程不会溢出面板

### 修复

- 移除 0.3.39 / 0.3.40 中导致封面错位、双影的飞行封面代码

## 0.3.40

### 修复

- 飞行封面坐标错误：改用页面相对坐标 + 中心点/布局尺寸测量，旋转中的方形唱片也不会让封面错位
- 关闭时真实封面与飞行封面双影：飞行期间隐藏真实封面
- 底栏点击封面/信息区无法打开播放页：移出点击排除列表
- 播放页窄窗口错位：封面/唱片改为响应式尺寸，980px 以下切单列布局，底部控制条边距自适应
- 播放页标题改为居中布局，两侧按钮对齐

## 0.3.39

### 重构

- 播放页切换动画重做为 Apple Music 式共享封面：底栏封面以 transform 飞到播放页封面位置（合成层），背景与内容随后依次淡入；关闭时封面飞回底栏
- 播放页视觉重做：封面 340px（唱片盘 380px）、圆角 20、更大的悬浮阴影与内描边；底部控制条改为半透明玻璃卡片（模糊 + 圆角 + 投影）；标题字号提升

### 修复

- 恢复 0.3.37 中丢失的 `.mu-np-art` 基础样式（封面容器尺寸/圆角），封面恢复正常显示

## 0.3.38

### 变更

- 底栏 → 播放页改用容器变换动画（Material Container Transform 思路）：播放页以底栏的矩形为起点（`transform` 缩放/平移，合成层），平滑放大到全屏，内容在放大后半段交叉淡入；关闭时反向收缩回底栏
- 能看到底栏区域扩展成播放页的过程，全程只动 `transform/opacity`，不再有重绘卡顿

## 0.3.37

### 变更

- 底栏 ⇄ 播放页切换动画改用 Web Animations API（合成层 transform/opacity）：播放页从底栏上方升起放大、底栏同步下沉淡出，关闭反向；移除 clip-path 过渡，避免大面积重绘卡顿
- 播放页：封面加内描边与底部渐暗、背景加品牌蓝径向光晕、底部控制区加渐变压暗
- 底栏：顶部高光细线、进度条改白色渐变

### 修复

- 打开/关闭动画可重复点击，旧动画会被取消，不会卡在半途

## 0.3.36

### 变更

- 点击底栏打开播放页改为「底栏展开」过渡：先测量底栏矩形，用 `clip-path` 从底栏位置（14px 圆角）平滑展开到全屏，关闭时反向收缩回底栏
- 播放页头部与主体在展开后延迟淡入，过渡更连贯

## 0.3.35

### 变更

- 侧栏迷你频谱只在播放时显示，暂停立即隐藏
- 播放列表里正在播放曲目的序号位置改为小频谱（暂停/其他曲目仍显示序号）
- 底栏视觉打磨：悬浮时玻璃提亮、封面投影、播放按钮 hover 微缩放与白色光晕、图标按钮 hover 背景、采样率胶囊、背景频谱顶部渐隐

## 0.3.34

### 变更

- 底栏压缩为紧凑的悬浮玻璃条：高度约 90 → 64px，14px 圆角、左右/底部留白
- 玻璃质感重做：55% 半透明背景 + 24px 模糊 + 1.4 饱和度、顶部内高光、底部投影
- 进度条改为底栏顶部 2px 细线（拖动/点击仍可用）；封面 48 → 40、播放按钮 40 → 36、字号收紧
- 背景频谱透明度降到 0.35，避免盖过信息

## 0.3.33

### 变更

- 侧栏「音乐」入口的迷你频谱移到名称右侧（hover 控制按钮左侧），不再紧贴图标；位置跟随行的实际位置，窗口缩放时重新测量
- 底栏改为半透明玻璃 + 背景模糊（`backdrop-filter: blur(18px) saturate(1.25)`），频谱条在玻璃层内显示

## 0.3.32

### 变更

- 侧栏「音乐」入口图标旁新增 40×14 迷你频谱（有播放曲目时显示）
- 底栏频谱改为铺满整个底栏的背景层：全宽、低透明度、条数随窗口宽度自适应，不再占用控制区空间

## 0.3.31

### 新增

- 底栏播放区新增实时频谱条：Web Audio `AnalyserNode` 驱动 canvas，28 根对数分桶、平滑衰减的跳变条（渲染方式参考 audvis / audioMotion-analyzer）
- 频谱在用户首次点击播放控制后启用，避免无手势时 AudioContext 挂起导致无声

## 0.3.30

### 修复

- 播放页歌词在歌曲开始、还没到第一句时间戳时停在顶部：现在把第一句当作当前行，开局就上下居中；同时去掉滚动偏移的 0 下限，首句与末句都能居中

## 0.3.29

### 修复

- 网格视图单击封面就直接播放：播放按钮改为封面中央的小圆钮，只有点它才播放，其余区域单击选中、双击播放
- 切歌后队列浮层不会自动定位到当前播放行：现在切歌会把当前行滚动到可视区域中间

## 0.3.28

### 新增

- 歌曲列表新增「封面网格」视图：工具栏按钮在列表 / 网格间切换，偏好记忆
- 网格卡片：封面、标题、艺术家；单击选中、双击播放；hover 显示播放按钮、收藏爱心、多选勾选；当前播放卡片蓝框高亮
- 网格按行虚拟化，列数随窗口宽度自适应（卡片最小 148px）；右键菜单与多选批量操作保持

## 0.3.27

### 变更

- 歌词滚动加入错峰效果：已唱行上移、未唱行下移、当前行居中，每行按与当前行的距离递增过渡延迟（22ms/阶，最多 8 阶），滚动时各行依次就位
- 当前行加轻微白色光晕；静态歌词保持平整排版

## 0.3.26

### 变更

- 去掉歌词当前行的蓝色填充与蓝色光晕：当前行改为纯白色加粗高亮
- 去掉歌词区域的淡蓝径向背景

## 0.3.25

### 变更

- 播放页歌词视觉升级（参考 AMLL / Apple Music 风格）：
  - 当前行改为品牌蓝逐行填充，随播放进度从左到右点亮，加粗 + 柔和光晕
  - 已唱行更淡、未唱行半透明，上下渐隐遮罩加强
  - 歌词行支持长句自动换行（`word-break` / `overflow-wrap`），行高 1.6
  - 去掉当前行缩放（避免换行抖动），滚动过渡放到 0.55s
  - 歌词区域加淡蓝径向背景；静态歌词保持可读

## 0.3.24

### 变更

- 「更换封面」从封面右下角的浮层按钮移到封面下方的操作行，与「恢复原封面」并排，不再遮挡封面与提示文字
- 窄窗口（≤760px）下编辑弹窗自动改为上下布局：封面在上、表单在下

## 0.3.23

### 新增

- 封面可替换：编辑弹窗左侧封面右下角「更换封面」，从在线匹配选中封面后实时预览，保存时下载并写入文件（FLAC PICTURE / MP3 APIC）
- 字段级搜索替换：每个字段右侧放大镜按钮，只回填该字段，不影响其他标签
- 已选在线封面显示「恢复原封面」与待写入提示

### 说明

- 封面地址仅允许 http/https 公网地址、≤ 8MB 且必须是图片；下载失败不会改动原文件

## 0.3.22

### 变更

- 在线匹配列表更紧凑：封面 128 → 72px，条目内边距/间距/字号整体缩小，弹窗宽度 940 → 860px，同屏可见更多结果

## 0.3.21

### 变更

- 在线匹配结果改为独立大弹窗列表：每项左侧 128px 封面，右侧标题/艺术家/专辑，底部年份、封面分辨率、Track、来源徽标
- 点击任一项直接回填字段并关闭匹配弹窗，回到编辑界面
- 匹配弹窗宽度 940px、最高 88vh，结果区独立滚动；底部显示各源状态

## 0.3.20

### 变更

- 元数据编辑改为左右布局：左侧固定专辑封面 + 标题/艺术家 + 格式/时长/采样率/码率徽标，右侧独立滚动的编辑栏，底部固定操作栏
- 弹窗加宽到 860px、最高 86vh；左侧带淡蓝渐变背景与分隔线

## 0.3.19

### 新增

- 元数据编辑弹窗「在线匹配」：按当前标题/艺术家/专辑同时搜索网易云、QQ 音乐、iTunes、MusicBrainz，候选列表带封面，点选回填字段
- Host 新增 `POST /music/online-search`：各源 8 秒超时、单源失败不影响其他源

### 说明

- 网易云 / QQ 音乐为非官方接口，可能随时失效或限流；在线结果仅供参考，保存前请核对

## 0.3.18

### 变更

- 元数据编辑弹窗重做：两列分组（基本信息 / 制作信息 / 歌词）、分组标题、独立滚动区、底部固定操作栏
- 去掉输入框聚焦时的白边：编辑弹窗内不再出现 focus 描边，输入框聚焦改为中性边框

## 0.3.17

### 新增

- 歌曲右键菜单「编辑元数据」：可改标题、艺术家、专辑、年份、音轨号、碟号、风格、专辑艺术家、作曲、作词、注释、歌词
- FLAC 写 Vorbis comments、MP3 写 ID3v2；写入走临时文件 + 回读校验 + 原子替换，失败不破坏原文件
- 保存后自动重扫音乐库；正在播放的曲目会先暂停再写入，避免 Windows 文件占用

## 0.3.16

### 变更

- 输入框内歌词与播放列表按钮合并为一个组件：歌词显示在按钮左侧（发送按钮前），不再单独占用输入框左侧座位
- 设置里的「输入框内」选项说明更新为「播放列表按钮左侧」

## 0.3.15

### 变更

- 新建歌单改为弹窗输入名字（默认自动命名，可直接改），支持 Enter 创建 / Esc 取消
- 歌单标题旁新增铅笔按钮：点击聚焦并全选标题，改名入口更明显
- 标题输入框获得焦点自动全选；清空后失焦恢复原名

## 0.3.14

### 变更

- 歌曲列表单列尺寸略微加大：封面 55 → 60px，行高 67 → 72px

## 0.3.13

### 修复

- 「在文件夹中显示」在 Windows 上没有定位到文件：explorer 参数改为 `/select,"C:\path\file"`（引号紧贴逗号），并用 `windowsVerbatimArguments` 原样传参，避免 Node 重新加引号/转义导致 explorer 忽略 `/select`

## 0.3.12

### 变更

- 收藏爱心改为红色（`--dsw-alias-state-error-primary`）
- 多选「添加到播放列表…」改为「添加到歌单」下拉菜单：显示歌单名与曲目数、支持新建歌单并添加，外观与交互重做
- 歌曲右键菜单：添加到歌单、添加到播放列表、复制文件地址、在文件夹中显示、详细信息
- 歌单视图的「从歌单移除」移入右键菜单，行内 × 按钮移除
- 新增 Host 接口 `POST /music/reveal`（仅限已配置音乐目录内的文件）：Windows `explorer /select`、macOS `open -R`、Linux `xdg-open`

## 0.3.11

### 变更

- 播放列表面板支持拖动移动位置：拖动顶部正在播放条/标题区即可，位置记在偏好里，下次打开恢复
- 播放列表面板内禁用文本框选（`user-select: none`）

## 0.3.10

### 变更

- 正在播放行改用 DSH 品牌蓝 `--dsw-static-deepseek-450`：歌曲名蓝色加粗、播放均衡器蓝色
- 高亮改为淡蓝底 + 左侧圆角蓝条 + 10px 圆角，替换原来的灰白块 + 生硬内阴影

## 0.3.9

### 修复

- 播放队列拖拽改为 Pointer Events 实现（参考 DSH 侧栏行拖拽的落点语义 + SortableJS 的 pointer 方案）：此前 HTML5 dragstart 在 composer 宿主浮层内不触发，导致松手后顺序不变
- 按住行左侧 `⋮⋮` 手柄拖动即可；拖拽中目标行显示插入线，松手立即重排；拖拽后不会误触发行的点击跳转

## 0.3.8

### 修复

- 修复播放队列拖拽松手后顺序不变：dragstart 中不再同步 setState（避免 Chromium 取消拖拽），拖拽源索引用 ref 记录
- 拖到行与行之间的空隙也能落位（容器兜底按指针位置计算目标行）

## 0.3.7

### 变更

- 会话输入框发送按钮左侧新增播放列表按钮（`conversation.input.right`），点击打开播放列表
- 设置 → 外观新增「输入框播放列表按钮」开关
- 播放列表改为全局浮层，主面板底栏按钮与输入框按钮两个入口共用
- 迷你浮窗并入播放列表顶部（封面 / 标题 / 播放控制），不再作为独立浮窗；移除设置里的迷你浮窗开关

## 0.3.6

### 变更

- 播放队列支持拖动排序（HTML5 drag & drop，交互参考 SortableJS：拖动手柄、拖动行半透明、目标行插入指示）
- 去掉队列行的上移/下移按钮，保留单曲移除
- 拖动后队列顺序即为播放顺序；随机模式下拖动后的视觉顺序同步为播放顺序

## 0.3.5

### 变更

- 播放队列、设置面板、排序菜单、播放页设置、迷你播放器、搜索历史等浮层背景统一为 DSH 设置面板的 `--dsw-alias-bg-layer-1`
- 移除播放队列头部的「清空队列」按钮（顶部「清空列表」按钮已在 0.3.3 移除）

## 0.3.4

### 变更

- 随机播放时，播放队列（播放列表）按实际播放顺序（乱序）展示，从上往下播放；切回顺序播放恢复原顺序
- 切换到随机播放时重新洗牌
- 双击歌曲 / 播放全部时，入队范围是当前歌单的完整曲目（忽略搜索过滤），从双击的歌曲开始

## 0.3.3

### 变更

- 移除主面板顶部「清空列表」按钮
- 正在播放行：品牌色高亮、3px 左侧竖条、标题品牌色加粗、播放均衡器动画（暂停时静止），封面遮罩常显暂停/播放图标

## 0.3.2

### 变更

- 播放顺序合并为三种互斥模式：顺序播放（播完停止）、随机播放（随机循环）、单曲循环；底栏、播放页、主面板 chips 三处按钮与图标同步
- 播放队列标题显示当前播放模式
- 旧状态归一化：升级后 `loop=all + order=list` 视为顺序播放

## 0.3.1

### 修复

- 修复 0.3.0 注入样式表中 `.mu-search-history` 规则缺少结尾 `}`，导致该规则之后的大量插件样式被浏览器丢弃、界面错乱的问题。
- 新增样式语法测试（`test/style.test.mjs`）：CI 会拦截括号/引号不平衡的 CSS，避免同类问题再次进包。

## 0.3.0

### 功能

- 收藏「我喜欢」：底栏与歌曲行爱心，独立 tab，`favorites.json` 持久化
- 最近播放：统计页新增「收听排行 / 最近播放」模式切换
- 队列编辑：上移、下移、移除单曲、清空队列
- 搜索增强：标题 / 歌手 / 专辑 / 文件夹 / 路径 + 全拼 / 首字母，多关键词 AND，记住最近 8 条搜索
- 超大曲库虚拟列表：列表只渲染可视行 + overscan
- 歌词校准：播放页按 ±0.5s 调整；可写回 MP3（ID3 USLT）/ FLAC（Vorbis LYRICS），写前备份 `.lyrics.bak`
- 多标签页互斥：Web Locks 选主，只有主控页发声与计时；其余页提示「另一个标签页正在播放」

### 依赖

- 新增 `node-id3`、`flac-tagger`（歌词写回）、`pinyin-pro`（拼音搜索）

### 数据

- 新增 `<DSH_HOME>/music/favorites.json`
- `stats.json` 增加 `lyricOffsetMs`

## 0.2.0

### 功能

- 记忆播放：启动 / 刷新后恢复上次的队列、当前曲目与播放位置（默认暂停，点 ▶ 继续）；设置里可开「恢复后自动播放」与「每首歌记住播放位置」
- 播放次数按 Last.fm / MusicBee 规则记录：曲目 > 30 秒，且播放到一半或 4 分钟（先到为准）才计一次，不再每次切歌就 +1
- 有效播放时长：只累计播放中自然前进的时间，拖动进度条不计，单次不足 30 秒的片段不计
- 统计页：主面板新增「统计」tab，支持最近一周 / 最近一月 / 全部时间，按时长 / 次数 / 最近排序，显示累计时长、播放次数、最近播放与汇总
- 新增接口：`GET/POST /music/state`、`POST /music/playback`、`GET/POST /music/position`、`GET /music/stats`
- 设置面板新增「播放」标签页

### 数据

- `stats.json` 扩展 `playSeconds`、`lastPlayedAt`、`lastPositionSec` 与最近 31 天的每日分桶；旧文件自动兼容
- 新增 `<DSH_HOME>/music/playback.json` 保存上次播放状态

## 0.1.0

首个公开版本。

### 功能

- 左侧栏音符入口 + 独立主面板；扫描本地音乐目录，读取封面、标题、歌手、专辑、时长、采样率与音质信息
- 播放控制：列表循环 / 单曲循环 / 不循环、随机播放、上一首 / 下一首、进度拖动、音量与静音
- 播放队列、格式 / 码率 / 采样率详情、复制文件路径；搜索、排序、多选「播放选中」
- 自建歌单：全部歌曲 + 每个歌单独立 tab（搜索 / 排序 / 多选 / 循环 / 随机），重命名、删除、逐首移除
- 全屏播放页：黑胶唱片 + 圆形封面（播放旋转、暂停定格）、可点击跳转的滚动歌词
- 歌词：内嵌歌词（ID3 USLT/SYLT、FLAC LYRICS、MP4 ©lyr）优先，回退同名 `.lrc`；支持多时间戳、元数据标签、原文 + 翻译合并
- 状态栏歌词：会话输入框内 / 输入框上方两种位置，显示当前唱词
- 设置面板：外观、歌词、音乐库三个标签页
- 常驻 `<audio>`（`shell.overlay`）+ MediaSession：主面板切走仍继续播放，系统媒体键可用
- 保护：`/music/stream` 与 `/music/cover` 的 `path` 经 `realpath` 校验根目录，越界返回 404；仅本机回环可用

### 说明

- npm 包名：`dsh-music-panel`；DSH patch id：`music`；本地 HTTP 前缀：`/music`



















