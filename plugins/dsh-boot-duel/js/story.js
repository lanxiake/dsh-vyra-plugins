/**
 * The two fighters talk.
 *
 * These are two office workers settling something in the corridor, and the
 * barks are what make the fight worth watching. The tone is the point:
 *
 *   - **playful, not bitter.** Nobody is a villain. The oppressor is "the
 *     demand", not this specific manager, and the lines are the jokes you tell
 *     about work — the ones that make everyone at the table laugh and nod.
 *   - **the player wins the argument, not the war.** Every story ends with
 *     something small and warm: a coffee, a nod, a joke shared.
 *   - **concrete, not abstract.** The comedy is in the specifics — 五彩斑斓的黑,
 *     "再黑一点，但要有光", the 340 hours of comp time.
 *
 * Each STORY is a cast and a line per beat of the fight. Beats fire on game
 * events, not on a timer:
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
 * A line is `[speaker, text, mood]`. Lines are dealt from a shuffled bag per
 * beat, so every line is heard before any repeats.
 */

export const STORIES = [
  {
    id: 'crunch',
    title: '加班',
    you: '你',
    rival: '组长',
    beats: {
      open: [
        ['rival', '这个需求，今晚上线哈。', 'cheery'],
        ['you', '文档呢？', 'flat'],
        ['rival', '要什么文档，先做出来看看嘛。', 'cheery'],
        ['you', '……行，那我做着，您泡咖啡。', 'dry'],
      ],
      chain: [
        ['you', '第一版。', 'flat'],
        ['you', '第二版。', 'flat'],
        ['you', '这是你上周说的第一版。', 'dry'],
        ['rival', '诶？我记得是第一版啊。', 'confused'],
      ],
      guard: [
        ['you', '挡住了。', 'dry'],
        ['rival', '我说的是「参考一下」，不是「照抄」。', 'cheery'],
        ['you', '这句话我听了六遍，第六遍是刚才。', 'tired'],
      ],
      hit: [
        ['you', '这个改动，一行代码。', 'flat'],
        ['you', '你昨天说不急的。', 'flat'],
        ['rival', '我说过这话吗？', 'confused'],
        ['you', '会议纪要里写着呢。', 'dry'],
      ],
      take: [
        ['you', '又是我的锅？', 'tired'],
        ['rival', '能者多劳嘛。', 'cheery'],
        ['you', '那能者多劳，能不能也多得？', 'dry'],
        ['rival', '……下次评优，我记着。', 'smooth'],
      ],
      super: [
        ['you', '这个方案，我再想想。', 'hard'],
        ['rival', '你先说说你的想法。', 'surprised'],
      ],
      ko: [
        ['you', '来杯咖啡？我请。', 'warm'],
        ['rival', '……加个奶。', 'beaten'],
      ],
      taunt: [
        ['rival', '明天早上九点前哈。', 'cheery'],
        ['rival', '你最近是不是没睡好。', 'cheery'],
        ['rival', '这个也抓一下，那个也抓一下。', 'cheery'],
        ['rival', '年轻人，多历练历练。', 'cheery'],
      ],
    },
  },

  {
    id: 'layoff',
    title: '优化',
    you: '你',
    rival: 'HR',
    beats: {
      open: [
        ['rival', '来，坐。喝点什么？', 'smooth'],
        ['you', '不渴。', 'flat'],
        ['rival', '公司最近在做一点组织调整。', 'smooth'],
        ['you', '调整的是我，对吧。', 'dry'],
      ],
      chain: [
        ['you', 'N+1 算一下。', 'flat'],
        ['you', '年假还有十二天。', 'flat'],
        ['you', '调休攒了三百四十小时。', 'dry'],
        ['rival', '……我让财务再核一下。', 'baffled'],
      ],
      guard: [
        ['you', '这个叫「协商一致」。', 'dry'],
        ['rival', '签字，对大家都好。', 'smooth'],
        ['you', '我再看看，不急。', 'flat'],
      ],
      hit: [
        ['you', '去年绩效 B+，你说的。', 'flat'],
        ['you', '邮件我留着呢。', 'dry'],
        ['rival', '邮件……那得看具体语境。', 'baffled'],
        ['you', '语境挺好的。', 'dry'],
      ],
      take: [
        ['you', '工位我自己收拾。', 'tired'],
        ['rival', '门禁卡下午失效哈。', 'smooth'],
        ['you', '行。那我把话说完再走。', 'flat'],
      ],
      super: [
        ['you', '这个字，我先不签。', 'hard'],
        ['rival', '诶，我们还可以再聊聊。', 'surprised'],
      ],
      ko: [
        ['you', '谢谢你这几年。', 'warm'],
        ['rival', '……有事儿随时联系。', 'beaten'],
      ],
      taunt: [
        ['rival', '这都是为了你好。', 'smooth'],
        ['rival', '公司也是一家人嘛。', 'smooth'],
        ['rival', '你多理解理解公司。', 'smooth'],
        ['rival', '这个我们之后再沟通。', 'smooth'],
      ],
    },
  },

  {
    id: 'deadline',
    title: '改稿',
    you: '你',
    rival: '甲方',
    beats: {
      open: [
        ['rival', '感觉不太对。', 'airy'],
        ['you', '哪儿不对？', 'flat'],
        ['rival', '说不上来，就是不太对。', 'airy'],
        ['you', '……那您说说，怎么改。', 'tired'],
      ],
      chain: [
        ['you', '第一稿。', 'flat'],
        ['you', '第七稿。', 'flat'],
        ['you', '第十八稿。', 'dry'],
        ['rival', '还是第一稿好。', 'airy'],
      ],
      guard: [
        ['you', '五彩斑斓的黑，调出来了。', 'dry'],
        ['rival', '再黑一点，但要有光。', 'airy'],
        ['you', '（深呼吸）好。', 'tired'],
      ],
      hit: [
        ['you', '这个字，再大一点。', 'flat'],
        ['you', 'logo 要大，但要显小。', 'dry'],
        ['rival', '你懂我意思吧。', 'airy'],
        ['you', '我不懂，但可以做。', 'dry'],
      ],
      take: [
        ['you', '今天下班前给您。', 'tired'],
        ['rival', '我明天一早就要哈。', 'airy'],
        ['you', '现在是晚上十一点。', 'flat'],
        ['rival', '那你抓紧嘛。', 'airy'],
      ],
      super: [
        ['you', '这一版，是我能给的最好的一版。', 'hard'],
        ['rival', '……好像确实还行。', 'surprised'],
      ],
      ko: [
        ['you', '合作愉快。', 'warm'],
        ['rival', '……下个项目还找你。', 'beaten'],
      ],
      taunt: [
        ['rival', '预算就这么多哈。', 'airy'],
        ['rival', '你再想想，我相信你。', 'airy'],
        ['rival', '大气一点，但别太贵。', 'airy'],
        ['rival', '我朋友说这样不好看。', 'airy'],
      ],
    },
  },
]

/**
 * Picks a story.
 *
 * A number picks one by index (the tests use this); no argument picks one
 * at random, and never the one that was just played — a "random" pick that
 * can repeat is the one thing players notice immediately.
 */
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
 * any repeats, and nothing repeats back to back across beats.
 */
export function createBarks(story, rng = Math.random) {
  const bags = {}
  return {
    story,
    /**
     * The next line for `beat`, or null when the story has nothing to say
     * there. Returns `{ speaker, text, mood }`.
     */
    next(beat) {
      const pool = story.beats[beat]
      if (!pool || pool.length === 0) return null
      if (!bags[beat] || bags[beat].length === 0) {
        const bag = pool.slice()
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[bag[i], bag[j]] = [bag[j], bag[i]]
        }
        bags[beat] = bag
      }
      const [speaker, text, mood] = bags[beat].pop()
      return { speaker, text, mood }
    },
  }
}
