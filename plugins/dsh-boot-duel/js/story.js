/**
 * The two fighters talk.
 *
 * Two people, one project, an argument that has been building for weeks. The
 * barks are what make the fight worth watching, and their shape is what makes
 * it read as an ARGUMENT rather than as a collection of quips:
 *
 *   - **every line answers the last one.** Consecutive lines should sound like
 *     the same conversation: a demand, a deflection, a "你怎么不说清楚", a
 *     retreat.
 *   - **nobody is the villain.** The joke is at the *project's* expense, not at
 *     a person's — the other side believes it is being helpful, and that is
 *     what is funny. Both fighters get their turn at being roasted.
 *   - **it escalates, then lands warm.** The opening is polite. The middle is
 *     the fight. The last line is a truce: a fix, a compromise, a cup of tea.
 *
 * The three scenes are deliberately generic — 改需求 / 联调 / 上线 — because
 * every project has all three, and none of them requires a villain. The roles
 * are "you" and "the other side of the table", whoever that happens to be.
 *
 * Beats fire on game events, not on a timer, so a line arrives on the beat that
 * caused it: a combo line only when there is a combo, a retreat line only when
 * the player was knocked down.
 *
 *   open   — the bell rings
 *   chain  — the player lands three hits in a row
 *   guard  — the player blocks
 *   hit    — a clean heavy lands
 *   take   — the player is knocked down
 *   super  — the finisher
 *   ko     — the opponent goes down
 *   taunt  — the opponent's line after it lands something big
 *
 * A line is `[speaker, text, mood]`, dealt from a shuffled bag per beat so
 * every line is heard before any repeats.
 */

export const STORIES = [
  {
    id: 'spec',
    title: '改需求',
    you: '你',
    rival: '产品',
    beats: {
      open: [
        ['rival', '有个小需求，特别简单。', 'airy'],
        ['you', '多小？', 'flat'],
        ['rival', '就加个按钮。', 'cheery'],
        ['you', '点一下会怎样？', 'flat'],
        ['rival', '跳到一个页面。', 'airy'],
        ['you', '那个页面做完了吗？', 'dry'],
        ['rival', '……这不就是你要做的吗。', 'cheery'],
        ['you', '所以是小需求，还是小按钮？', 'flat'],
        ['rival', '先做出来，我们再对。', 'smooth'],
        ['you', '每次都是先做出来。', 'tired'],
      ],
      chain: [
        ['you', '这个按钮放哪，你总得说吧。', 'flat'],
        ['rival', '你先按你的理解做。', 'airy'],
        ['you', '我的理解是放首页最上面。', 'dry'],
        ['rival', '不行，太显眼了。', 'hard'],
        ['you', '那你说放哪。', 'flat'],
        ['rival', '你觉得呢？', 'cheery'],
        ['you', '我觉得你应该先说。', 'dry'],
        ['rival', '我这不是在跟你商量吗。', 'smooth'],
        ['you', '你这叫让我猜。', 'flat'],
        ['rival', '大家都是为了把东西做好。', 'cheery'],
        ['you', '那就先把「做好」定义一下。', 'dry'],
        ['rival', '……', 'tired'],
        ['you', '看，又卡住了。', 'flat'],
      ],
      guard: [
        ['you', '这个真做不了。', 'flat'],
        ['rival', '为什么做不了？', 'hard'],
        ['you', '点一下跳三个页面，逻辑说不通。', 'dry'],
        ['rival', '那改两个页面。', 'airy'],
        ['you', '为什么是两个？', 'flat'],
        ['rival', '感觉差不多。', 'cheery'],
        ['you', '感觉不是需求文档。', 'dry'],
        ['rival', '文档可以后补嘛。', 'airy'],
        ['you', '上线了也能后补吗。', 'flat'],
      ],
      hit: [
        ['you', '这个需求上周刚改过。', 'flat'],
        ['rival', '用户反馈嘛。', 'airy'],
        ['you', '哪个用户？', 'dry'],
        ['rival', '就……用户。', 'cheery'],
        ['you', '你吧。', 'flat'],
        ['rival', '我代表用户。', 'smooth'],
        ['you', '那我代表加班。', 'dry'],
        ['rival', '就调一下顺序，很快的。', 'airy'],
        ['you', '上次那个「很快的」用了两周。', 'flat'],
        ['rival', '这次真的快。', 'cheery'],
        ['you', '上次你也这么说。', 'tired'],
      ],
      take: [
        ['you', '好，我改。', 'tired'],
        ['rival', '辛苦了辛苦了。', 'cheery'],
        ['you', '改完要保留旧版吗？', 'flat'],
        ['rival', '不用。', 'airy'],
        ['you', '那有人要用旧的怎么办？', 'dry'],
        ['rival', '应该不会吧。', 'cheery'],
        ['you', '上线第二天就会出现。', 'tired'],
        ['rival', '到时候再说。', 'smooth'],
        ['you', '到时候就是我的周末。', 'dry'],
        ['rival', '相信你的能力。', 'cheery'],
        ['you', '我更相信你的嘴。', 'flat'],
      ],
      super: [
        ['you', '停，我们先对一遍需求。', 'hard'],
        ['rival', '现在？', 'surprised'],
        ['you', '就现在，一条一条来。', 'hard'],
        ['rival', '……行吧。', 'shaken'],
        ['you', '第一条就说不清楚。', 'hard'],
        ['rival', '那先跳过第一条。', 'baffled'],
      ],
      ko: [
        ['rival', '……行，是我没说清楚。', 'beaten'],
        ['you', '你现在说清楚就行。', 'warm'],
        ['rival', '那我重新写一版。', 'beaten'],
        ['you', '写完我们再打。', 'warm'],
      ],
      taunt: [
        ['rival', '这很简单的。', 'airy'],
        ['rival', '参考一下那个网站。', 'smooth'],
        ['rival', '先做一个版本给我看。', 'cheery'],
        ['rival', '我要那种感觉，你懂的。', 'airy'],
        ['rival', '不用太完美，能用就行。', 'smooth'],
        ['rival', '但细节还是要打磨一下。', 'airy'],
        ['rival', '什么时候能好？', 'hard'],
        ['rival', '我不是催你。', 'cheery'],
        ['rival', '就随便问问。', 'smooth'],
        ['rival', '你怎么不说话了？', 'confused'],
        ['rival', '这个应该不花时间吧。', 'airy'],
        ['rival', '我下午还约了人。', 'smooth'],
      ],
    },
  },

  {
    id: 'api',
    title: '联调',
    you: '你',
    rival: '后端',
    beats: {
      open: [
        ['rival', '接口给你了，看一下。', 'flat'],
        ['you', '文档呢？', 'dry'],
        ['rival', '接口就是文档。', 'smooth'],
        ['you', '字段没注释。', 'flat'],
        ['rival', '字段名就是注释。', 'cheery'],
        ['you', 'data2_new 是什么意思？', 'dry'],
        ['rival', '……就是第二个 data 的新版。', 'smooth'],
        ['you', '那 data2_old 呢？', 'flat'],
        ['rival', '你先接，我在改。', 'airy'],
        ['you', '改完字段名也会变吗？', 'tired'],
      ],
      chain: [
        ['you', '你这个接口返回 500。', 'flat'],
        ['rival', '那是你传参不对。', 'hard'],
        ['you', '文档就是这么写的。', 'dry'],
        ['rival', '文档我更新了。', 'smooth'],
        ['you', '什么时候更新的？', 'flat'],
        ['rival', '刚才。', 'cheery'],
        ['you', '我照着旧的写完了。', 'dry'],
        ['rival', '那你照新的再改一下。', 'airy'],
        ['you', '这就是联调的意义对吧。', 'tired'],
        ['rival', '对，提前发现问题。', 'cheery'],
        ['you', '提前发现问题的是我。', 'flat'],
      ],
      guard: [
        ['you', '这块数据是空的。', 'flat'],
        ['rival', '本地有啊。', 'hard'],
        ['you', '我在线上看的。', 'dry'],
        ['rival', '线上环境不一样。', 'smooth'],
        ['you', '那到底哪个算对？', 'flat'],
        ['rival', '以线上为准。', 'hard'],
        ['you', '线上是空的。', 'dry'],
        ['rival', '那我看看本地。', 'airy'],
        ['you', '你看吧。', 'flat'],
      ],
      hit: [
        ['you', '这个字段会变。', 'flat'],
        ['rival', '不会变。', 'hard'],
        ['you', '上次也是这么说的。', 'dry'],
        ['rival', '上次是特殊情况。', 'smooth'],
        ['you', '那这次呢？', 'flat'],
        ['rival', '这次是正常情况。', 'cheery'],
        ['you', '正常的定义是「会变」吗。', 'dry'],
        ['rival', '我会通知你的。', 'airy'],
        ['you', '什么时候通知？', 'flat'],
        ['rival', '会变的之前。', 'smooth'],
        ['you', '……那就是不会通知。', 'tired'],
      ],
      take: [
        ['you', '好，我按你说的改。', 'tired'],
        ['rival', '对，就这样传。', 'cheery'],
        ['you', '改完还是 500。', 'flat'],
        ['rival', '那你看看日志。', 'smooth'],
        ['you', '日志里是你的报错。', 'dry'],
        ['rival', '那你先按我的思路排查一下。', 'airy'],
        ['you', '排查完还是你的报错呢？', 'flat'],
        ['rival', '那就再排查。', 'cheery'],
        ['you', '我们是在做项目，还是在互相传话。', 'tired'],
        ['rival', '这叫协作。', 'smooth'],
      ],
      super: [
        ['you', '把文档补上，我们从头对。', 'hard'],
        ['rival', '现在？', 'surprised'],
        ['you', '就现在，一个字段一个字段。', 'hard'],
        ['rival', '……好吧。', 'shaken'],
        ['you', '第一个字段。', 'hard'],
        ['rival', '……这个我也要查一下。', 'baffled'],
      ],
      ko: [
        ['rival', '……行，文档我补。', 'beaten'],
        ['you', '早该补了。', 'warm'],
        ['rival', '下次你先看文档。', 'beaten'],
        ['you', '下次你先把文档写完。', 'warm'],
      ],
      taunt: [
        ['rival', '接口很简单的。', 'airy'],
        ['rival', '你那边是不是缓存了？', 'smooth'],
        ['rival', '我这边测是好的。', 'cheery'],
        ['rival', '你换个网络试试。', 'airy'],
        ['rival', '这个问题我复现不了。', 'smooth'],
        ['rival', '你截图看一下。', 'hard'],
        ['rival', '截图里看不到报文。', 'airy'],
        ['rival', '那你把报文发我。', 'smooth'],
        ['rival', '我看了，一切正常。', 'cheery'],
        ['rival', '是不是你用错了。', 'airy'],
        ['rival', '文档上写得很清楚。', 'hard'],
        ['rival', '哪个文档？就是那个文档。', 'smooth'],
      ],
    },
  },

  {
    id: 'launch',
    title: '上线',
    you: '你',
    rival: '测试',
    beats: {
      open: [
        ['rival', '这个版本有个问题。', 'airy'],
        ['you', '什么问题？', 'flat'],
        ['rival', '偶现。', 'airy'],
        ['you', '怎么复现？', 'dry'],
        ['rival', '不知道，就是会出现。', 'smooth'],
        ['you', '出现的时候什么样？', 'flat'],
        ['rival', '……反正不对。', 'cheery'],
        ['you', '那我们怎么修？', 'tired'],
        ['rival', '你们开发最懂了。', 'airy'],
        ['you', '我们最懂的是它没问题。', 'dry'],
      ],
      chain: [
        ['you', '我按你说的步骤试了十遍。', 'flat'],
        ['rival', '那可能是环境。', 'airy'],
        ['you', '同一个环境。', 'dry'],
        ['rival', '那就是时机。', 'smooth'],
        ['you', '什么时机？', 'flat'],
        ['rival', '你手速快一点。', 'cheery'],
        ['you', '我手速快它就坏？', 'dry'],
        ['rival', '有可能。', 'airy'],
        ['you', '那用户手速快了怎么办。', 'flat'],
        ['rival', '这就是要修的原因嘛。', 'cheery'],
        ['you', '所以问题是我的手。', 'tired'],
      ],
      guard: [
        ['you', '这个改动不能上。', 'flat'],
        ['rival', '为什么不能上？', 'hard'],
        ['you', '影响面太大。', 'dry'],
        ['rival', '那我怎么验证？', 'airy'],
        ['you', '验证不了。', 'flat'],
        ['rival', '验证不了就是没做。', 'hard'],
        ['you', '验证不了就应该分批上。', 'dry'],
        ['rival', '我们流程没有分批。', 'smooth'],
        ['you', '那我们就加一个。', 'flat'],
      ],
      hit: [
        ['you', '这个 bug 老版本就有。', 'flat'],
        ['rival', '那更要修了。', 'hard'],
        ['you', '那它就不是这次引入的。', 'dry'],
        ['rival', '所以你们一直没修？', 'hard'],
        ['you', '所以这不是这次的问题。', 'flat'],
        ['rival', '都是问题。', 'airy'],
        ['you', '但不是一个问题。', 'dry'],
        ['rival', '你还分得挺细。', 'cheery'],
        ['you', '我分得细，你测得细一点。', 'flat'],
      ],
      take: [
        ['you', '好，我先加日志。', 'tired'],
        ['rival', '加日志能修吗？', 'airy'],
        ['you', '能知道它在哪坏的。', 'flat'],
        ['rival', '那多久能修好？', 'hard'],
        ['you', '先知道，再谈修。', 'dry'],
        ['rival', '上线前能修好吗？', 'smooth'],
        ['you', '上线时间是谁定的？', 'flat'],
        ['rival', '不知道，反正不是我们。', 'cheery'],
        ['you', '那就把这个也一起问问。', 'tired'],
        ['rival', '问了也没用。', 'smooth'],
      ],
      super: [
        ['you', '这一版先别上，先把它复现出来。', 'hard'],
        ['rival', '可是时间到了。', 'surprised'],
        ['you', '复现出来再上，我负责修。', 'hard'],
        ['rival', '……行，我盯着看。', 'shaken'],
        ['you', '我们一起看。', 'hard'],
        ['rival', '好，我给你倒杯水。', 'warm'],
      ],
      ko: [
        ['rival', '……复现了，是那个空值。', 'beaten'],
        ['you', '好，我改。', 'warm'],
        ['rival', '这次是我没说清。', 'beaten'],
        ['you', '下次直接把日志给我。', 'warm'],
      ],
      taunt: [
        ['rival', '我这边没问题。', 'airy'],
        ['rival', '你重启一下试试。', 'smooth'],
        ['rival', '清一下缓存。', 'cheery'],
        ['rival', '我昨天还是好的。', 'airy'],
        ['rival', '这个功能本来就没人用。', 'smooth'],
        ['rival', '要不先上了再说。', 'airy'],
        ['rival', '出了问题可以回滚。', 'cheery'],
        ['rival', '回滚过一次了。', 'smooth'],
        ['rival', '那就再回滚一次。', 'airy'],
        ['rival', '我提的这些都是为项目好。', 'cheery'],
        ['rival', '你别往心里去。', 'airy'],
        ['rival', '我不是针对你。', 'smooth'],
      ],
    },
  },
]

/** Picks a story by index, or at random without repeating the last one. */
export function storyFor(round, { avoid = null, rng = Math.random } = {}) {
  if (Number.isFinite(round)) {
    return STORIES[Math.abs(Math.floor(round)) % STORIES.length]
  }
  const pool = STORIES.filter((story) => story.id !== avoid)
  return pool[Math.floor(rng() * pool.length)] ?? STORIES[0]
}

/**
 * A bark chooser. One per round.
 *
 * Lines are dealt from a shuffled bag per beat, so every line is heard before
 * any repeats. The bag is refilled when empty, and the refill refuses to lead
 * with the line just spoken — otherwise the one repeat nobody notices is
 * always the one that matters.
 */
export function createBarks(story, rng = Math.random) {
  const bags = {}
  const lastSaid = {}
  /**
   * The opening is a script, not a bag.
   *
   * Each story's `open` lines are written as an exchange — a demand, a
   * deflection, a push — so they play back in the order they were written.
   * The set is still rotated BETWEEN rounds, so two visits do not start the
   * same way.
   */
  const openScript = (() => {
    const lines = story.beats.open ?? []
    const start = Math.floor(rng() * Math.max(1, lines.length))
    // A rotation, not a shuffle: any starting point reads as a conversation.
    return lines.slice(start).concat(lines.slice(0, start))
  })()
  let openAt = 0

  return {
    story,
    /**
     * The next line for `beat`, or null when the story has nothing to say
     * there. Returns `{ speaker, text, mood }`.
     */
    next(beat) {
      if (beat === 'open') {
        if (openAt >= openScript.length) return null
        const [speaker, text, mood] = openScript[openAt]
        openAt += 1
        return { speaker, text, mood }
      }
      const pool = story.beats[beat]
      if (!pool || pool.length === 0) return null
      if (!bags[beat] || bags[beat].length === 0) {
        const bag = pool.slice()
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[bag[i], bag[j]] = [bag[j], bag[i]]
        }
        // A refill must not start with what just played.
        const recent = lastSaid[beat]
        if (recent !== undefined && bag[bag.length - 1] === recent && bag.length > 1) {
          ;[bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]]
        }
        bags[beat] = bag
      }
      const line = bags[beat].pop()
      lastSaid[beat] = line
      const [speaker, text, mood] = line
      return { speaker, text, mood }
    },
  }
}
