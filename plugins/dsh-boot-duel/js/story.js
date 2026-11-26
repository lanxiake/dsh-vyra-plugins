/**
 * The two fighters talk.
 *
 * Two people, one office, an argument that has been building for months. The
 * barks are what make the fight worth watching, and their shape is what makes
 * it read as an ARGUMENT rather than as a collection of quips:
 *
 *   - **every line answers the last one.** Consecutive lines should sound like
 *     the same conversation: a demand, a refusal, a "你怎么说话的", a retreat.
 *   - **the opponent is never a villain.** The joke is at the situation's
 *     expense, not at a person's — the boss believes he is being reasonable,
 *     the client believes he is being specific, and that is what is funny.
 *   - **it escalates, then lands warm.** The opening is polite. The middle is
 *     the fight. The last line is a truce.
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
    id: 'boss',
    title: '领导',
    you: '你',
    rival: '领导',
    beats: {
      open: [
        ['rival', '来我办公室一趟。', 'smooth'],
        ['you', '……现在？', 'flat'],
        ['rival', '就现在，坐。', 'smooth'],
        ['you', '我站着就行。', 'flat'],
        ['rival', '坐嘛，别紧张。', 'cheery'],
        ['you', '您先说事。', 'dry'],
        ['rival', '这个项目，我们得聊聊。', 'smooth'],
        ['you', '我猜到了。', 'flat'],
      ],
      chain: [
        ['you', '我上周说的风险，就是这个。', 'flat'],
        ['rival', '当时情况不一样。', 'smooth'],
        ['you', '情况哪儿不一样？', 'dry'],
        ['rival', '你不要这个态度。', 'hard'],
        ['you', '我什么态度？', 'flat'],
        ['rival', '我在跟你讨论问题。', 'hard'],
        ['you', '我也在跟您讨论问题。', 'dry'],
        ['rival', '行，你说。', 'hard'],
        ['you', '我说完了，您没听。', 'flat'],
      ],
      guard: [
        ['you', '这个锅我不背。', 'flat'],
        ['rival', '谁跟你说是锅了？', 'hard'],
        ['you', '您刚才那句就是。', 'dry'],
        ['rival', '我是说流程上可以优化。', 'smooth'],
        ['you', '流程没错，是排期错了。', 'flat'],
        ['rival', '排期是大家一起定的。', 'smooth'],
        ['you', '定的时候我不在。', 'dry'],
      ],
      hit: [
        ['you', '这个需求，两周做不完。', 'flat'],
        ['rival', '别人都能做完。', 'hard'],
        ['you', '哪个别人？', 'dry'],
        ['rival', '你不要总跟别人比。', 'hard'],
        ['you', '那您也别总拿别人压我。', 'flat'],
        ['rival', '我这是给你机会。', 'smooth'],
        ['you', '这机会我谢谢您。', 'dry'],
        ['rival', '年轻人要有点冲劲。', 'cheery'],
        ['you', '我冲了，您看见了吗。', 'flat'],
      ],
      take: [
        ['you', '行，我加班。', 'tired'],
        ['rival', '这就对了嘛。', 'cheery'],
        ['you', '加班费怎么算？', 'flat'],
        ['rival', '谈钱就俗了。', 'smooth'],
        ['you', '那我就俗一点。', 'dry'],
        ['rival', '年底绩效我给你考虑。', 'smooth'],
        ['you', '这话我去年也听过。', 'tired'],
        ['rival', '今年不一样。', 'cheery'],
      ],
      super: [
        ['you', '这个需求，我不接。', 'hard'],
        ['rival', '你说什么？', 'surprised'],
        ['you', '我说，我不接。', 'hard'],
        ['rival', '你想清楚了？', 'shaken'],
      ],
      ko: [
        ['rival', '……坐下说吧。', 'beaten'],
        ['you', '好，我坐。', 'warm'],
        ['rival', '你想怎么弄？', 'beaten'],
        ['you', '先把范围砍一半。', 'warm'],
      ],
      taunt: [
        ['rival', '这不是我一个人的意思。', 'smooth'],
        ['rival', '上面压下来的。', 'smooth'],
        ['rival', '我也是为你好。', 'smooth'],
        ['rival', '你要学会换位思考。', 'smooth'],
        ['rival', '我们是一个团队。', 'cheery'],
        ['rival', '这点小事都扛不住？', 'hard'],
        ['rival', '我以前比你苦多了。', 'smooth'],
        ['rival', '别把情绪带到工作里。', 'hard'],
        ['rival', '你先执行，有问题再说。', 'smooth'],
      ],
    },
  },

  {
    id: 'client',
    title: '客户',
    you: '你',
    rival: '甲方',
    beats: {
      open: [
        ['rival', '在吗？', 'airy'],
        ['you', '在的。', 'flat'],
        ['rival', '有个小想法。', 'airy'],
        ['you', '您说。', 'flat'],
        ['rival', '感觉还是不太对。', 'airy'],
        ['you', '……哪里不对？', 'tired'],
        ['rival', '说不上来，就是不对。', 'airy'],
        ['you', '那我先改改看。', 'flat'],
      ],
      chain: [
        ['you', '这是第七稿。', 'flat'],
        ['rival', '辛苦了，但方向还是差一点。', 'airy'],
        ['you', '您上次说这个方向对的。', 'dry'],
        ['rival', '我说的是上个版本。', 'airy'],
        ['you', '上个版本您也说不对。', 'flat'],
        ['rival', '那是我表达得不清楚。', 'airy'],
        ['you', '是我理解得不够。', 'dry'],
        ['rival', '你能这么想就好。', 'cheery'],
        ['you', '……', 'tired'],
      ],
      guard: [
        ['you', '这个改不了。', 'flat'],
        ['rival', '为什么改不了？', 'hard'],
        ['you', '技术上做不到。', 'dry'],
        ['rival', '别人能做，你做不到？', 'hard'],
        ['you', '哪个别人？', 'flat'],
        ['rival', '我看人家网站就是这样。', 'airy'],
        ['you', '那您找人家做。', 'dry'],
      ],
      hit: [
        ['you', '这个需求加钱。', 'flat'],
        ['rival', '合同里写了的。', 'hard'],
        ['you', '合同里没写这个。', 'dry'],
        ['rival', '合同里写了「等」。', 'airy'],
        ['you', '那个「等」是指配色。', 'flat'],
        ['rival', '都一样嘛。', 'cheery'],
        ['you', '不一样。', 'dry'],
        ['rival', '你这个人怎么这么较真。', 'hard'],
      ],
      take: [
        ['you', '好，我改。', 'tired'],
        ['rival', '辛苦你了。', 'cheery'],
        ['you', '什么时候要？', 'flat'],
        ['rival', '今天下班前。', 'airy'],
        ['you', '现在四点半。', 'flat'],
        ['rival', '那你抓紧嘛。', 'cheery'],
        ['you', '我尽量。', 'tired'],
        ['rival', '不是尽量，是必须。', 'hard'],
      ],
      super: [
        ['you', '这一版，是最后一版。', 'hard'],
        ['rival', '你这是什么态度？', 'surprised'],
        ['you', '正常态度。', 'hard'],
        ['rival', '我要投诉你。', 'shaken'],
      ],
      ko: [
        ['rival', '……行吧，就这版。', 'beaten'],
        ['you', '谢谢。', 'warm'],
        ['rival', '下次还找你。', 'beaten'],
        ['you', '下次涨价。', 'warm'],
      ],
      taunt: [
        ['rival', '预算就这么多。', 'airy'],
        ['rival', '你先做着，钱的事再说。', 'airy'],
        ['rival', '我朋友说这样不好看。', 'airy'],
        ['rival', '大气一点，但别太贵。', 'airy'],
        ['rival', '要有设计感，但看不出来设计。', 'airy'],
        ['rival', '你们专业的，你看着办。', 'cheery'],
        ['rival', '我老板明天要看。', 'hard'],
        ['rival', '这个能不能免费带一下？', 'airy'],
        ['rival', '别急，我不是催你。', 'smooth'],
      ],
    },
  },

  {
    id: 'ceo',
    title: '老板',
    you: '你',
    rival: '老板',
    beats: {
      open: [
        ['rival', '来来来，坐。', 'cheery'],
        ['you', '您找我？', 'flat'],
        ['rival', '聊聊，随便聊聊。', 'cheery'],
        ['you', '……好。', 'flat'],
        ['rival', '你觉得公司现在怎么样？', 'smooth'],
        ['you', '挺忙的。', 'dry'],
        ['rival', '忙是好事。', 'cheery'],
        ['you', '是。', 'flat'],
      ],
      chain: [
        ['you', '人手不够。', 'flat'],
        ['rival', '我们要有创业精神。', 'smooth'],
        ['you', '创业精神发不出工资。', 'dry'],
        ['rival', '格局要大一点。', 'hard'],
        ['you', '我房租也很实际。', 'flat'],
        ['rival', '你现在是在跟我谈格局？', 'hard'],
        ['you', '我在跟您谈合同。', 'dry'],
        ['rival', '合同是死的，人是活的。', 'smooth'],
        ['you', '人也是要吃饭的。', 'flat'],
      ],
      guard: [
        ['you', '这个季度的目标不现实。', 'flat'],
        ['rival', '我们就是要挑战不可能。', 'smooth'],
        ['you', '那您先说说怎么做。', 'dry'],
        ['rival', '这不该我问你吗？', 'hard'],
        ['you', '我问的就是这个。', 'flat'],
        ['rival', '你要先有想法。', 'smooth'],
        ['you', '我有，但您不批预算。', 'dry'],
      ],
      hit: [
        ['you', '我要涨薪。', 'flat'],
        ['rival', '公司现在困难。', 'smooth'],
        ['you', '去年也这么说。', 'dry'],
        ['rival', '今年是真困难。', 'smooth'],
        ['you', '那您换车的时候不困难？', 'flat'],
        ['rival', '那是公司的车。', 'hard'],
        ['you', '您家人的名字上的。', 'dry'],
        ['rival', '你这话什么意思？', 'shaken'],
      ],
      take: [
        ['you', '好，我做。', 'tired'],
        ['rival', '这才对。', 'cheery'],
        ['you', '但我要两个人。', 'flat'],
        ['rival', '先从内部调。', 'smooth'],
        ['you', '内部没人了。', 'dry'],
        ['rival', '那就招。', 'smooth'],
        ['you', '招了三个月了。', 'tired'],
        ['rival', '再等等，马上就有。', 'cheery'],
      ],
      super: [
        ['you', '我不干了。', 'hard'],
        ['rival', '你说什么？', 'surprised'],
        ['you', '我说，我不干了。', 'hard'],
        ['rival', '……你冷静一下。', 'shaken'],
      ],
      ko: [
        ['rival', '……我们再谈谈。', 'beaten'],
        ['you', '谈什么？', 'warm'],
        ['rival', '条件。', 'beaten'],
        ['you', '好，我们谈条件。', 'warm'],
      ],
      taunt: [
        ['rival', '我们是一家人。', 'cheery'],
        ['rival', '公司就是你们的平台。', 'smooth'],
        ['rival', '我当年比你还苦。', 'smooth'],
        ['rival', '要有主人翁意识。', 'cheery'],
        ['rival', '钱不是最重要的。', 'smooth'],
        ['rival', '你要看到长期价值。', 'smooth'],
        ['rival', '我也是从基层做起的。', 'cheery'],
        ['rival', '年轻人不要怕吃亏。', 'smooth'],
        ['rival', '这个我记在心里了。', 'smooth'],
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
   * The set is still shuffled BETWEEN rounds, so two visits do not start the
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
