/**
 * The two fighters talk.
 *
 * These are two developers settling something in an office, and the barks are
 * what make the fight worth watching. The tone is the point:
 *
 *   - **playful, not bitter.** Nobody is a villain. The comedy is the jokes
 *     developers actually tell each other — the ones where everyone winces and
 *     then laughs, because it happened to them last Tuesday.
 *   - **concrete, not abstract.** The humour is in the specifics: "在我电脑上
 *     是好的", the third refactor of a function nobody calls, the comment that
 *     says what the code did two years ago.
 *   - **the player wins the argument, not the war.** Every story ends warm.
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
    id: 'works-on-my-machine',
    title: '在我电脑上是好的',
    you: '你',
    rival: '同事',
    beats: {
      open: [
        ['rival', '诶，你这个功能在测试环境挂了。', 'cheery'],
        ['you', '我本地跑得好好的。', 'flat'],
        ['rival', '真的，你来看一下。', 'cheery'],
        ['you', '……行，我看看。', 'tired'],
      ],
      chain: [
        ['you', '本地过。', 'flat'],
        ['you', 'CI 也过了。', 'flat'],
        ['you', '只有你的电脑不行。', 'dry'],
        ['rival', '那……是不是你少提交了文件？', 'confused'],
      ],
      guard: [
        ['you', '我加了日志的。', 'dry'],
        ['rival', '日志里没打出来。', 'cheery'],
        ['you', '因为那个分支没走到。', 'flat'],
      ],
      hit: [
        ['you', 'node_modules 删了重装。', 'flat'],
        ['rival', '啊，好了。', 'surprised'],
        ['you', '……我就说。', 'dry'],
        ['rival', '那你早说嘛。', 'cheery'],
      ],
      take: [
        ['you', '我再看看……', 'tired'],
        ['rival', '要不要我远程连一下？', 'cheery'],
        ['you', '不用不用。', 'flat'],
        ['rival', '那我先把这个 bug 指派给你了。', 'smooth'],
      ],
      super: [
        ['you', '这不是 bug，这是特性。', 'hard'],
        ['rival', '……你认真的？', 'surprised'],
      ],
      ko: [
        ['you', '一起看看？', 'warm'],
        ['rival', '好啊，我这还有个更离谱的。', 'beaten'],
      ],
      taunt: [
        ['rival', '你那边是什么环境？', 'cheery'],
        ['rival', '我这边是好的呀。', 'cheery'],
        ['rival', '是不是缓存的问题？', 'cheery'],
        ['rival', '你重启一下试试。', 'cheery'],
      ],
    },
  },

  {
    id: 'legacy',
    title: '这段代码谁写的',
    you: '你',
    rival: '前任',
    beats: {
      open: [
        ['rival', '这块逻辑你别动。', 'smooth'],
        ['you', '为什么？', 'flat'],
        ['rival', '没有为什么，动了会出事。', 'smooth'],
        ['you', '……好吧。', 'tired'],
      ],
      chain: [
        ['you', '这里为什么乘 1.08？', 'flat'],
        ['you', '这个变量为什么叫 tmp2？', 'flat'],
        ['you', '为什么注释写的是 2019 年？', 'dry'],
        ['rival', '年代久远，记不清了。', 'baffled'],
      ],
      guard: [
        ['you', '这段代码没人调用。', 'dry'],
        ['rival', '不能删，万一有用呢。', 'smooth'],
        ['you', '三年了。', 'flat'],
      ],
      hit: [
        ['you', '我 grep 过了，零引用。', 'flat'],
        ['rival', '可能动态调用的。', 'baffled'],
        ['you', '这是静态语言。', 'dry'],
        ['rival', '……那也不能删。', 'smooth'],
      ],
      take: [
        ['you', '行吧，我加个注释。', 'tired'],
        ['rival', '注释写清楚点。', 'smooth'],
        ['you', '「不要动」。', 'dry'],
        ['rival', '对，就这样。', 'smooth'],
      ],
      super: [
        ['you', '这段代码，我今天一定要重构。', 'hard'],
        ['rival', '你别！真的别！', 'surprised'],
      ],
      ko: [
        ['you', '重构完了，测试全过。', 'warm'],
        ['rival', '……居然没炸。', 'beaten'],
      ],
      taunt: [
        ['rival', '这段别动，能用就行。', 'smooth'],
        ['rival', '线上跑了好几年了。', 'smooth'],
        ['rival', '你不懂当时的背景。', 'smooth'],
        ['rival', '这个我加过注释的。', 'smooth'],
      ],
    },
  },

  {
    id: 'review',
    title: '代码评审',
    you: '你',
    rival: '评审人',
    beats: {
      open: [
        ['rival', '你这个 PR 我看了。', 'cheery'],
        ['you', '嗯，有问题吗？', 'flat'],
        ['rival', '有点小意见，不多，就 47 条。', 'cheery'],
        ['you', '……啊。', 'tired'],
      ],
      chain: [
        ['you', '第一条改好了。', 'flat'],
        ['you', '第十条改好了。', 'flat'],
        ['you', '第四十七条改好了。', 'dry'],
        ['rival', '哦对了，这里还有个可以优化的点。', 'cheery'],
      ],
      guard: [
        ['you', '这个命名我觉得没问题。', 'dry'],
        ['rival', '能不能叫得更「业务」一点？', 'cheery'],
        ['you', '……我改。', 'tired'],
      ],
      hit: [
        ['you', '这行是自动格式化加的。', 'flat'],
        ['rival', '哦，那不用改。', 'surprised'],
        ['you', '……', 'dry'],
        ['rival', '不过你格式能不能统一一下？', 'cheery'],
      ],
      take: [
        ['you', '好，我改。', 'tired'],
        ['rival', '辛苦啦，你这个改完我们就合。', 'cheery'],
        ['you', '上次也这么说。', 'flat'],
        ['rival', '这次真的！', 'cheery'],
      ],
      super: [
        ['you', '这个 PR，我改完了。全部。', 'hard'],
        ['rival', '……我看看。哦，可以合了。', 'surprised'],
      ],
      ko: [
        ['you', '合了。', 'warm'],
        ['rival', '嗯，写得挺干净的。', 'beaten'],
      ],
      taunt: [
        ['rival', '这个能拆成两个函数吗？', 'cheery'],
        ['rival', '这里加个注释吧。', 'cheery'],
        ['rival', '这个变量名能不能再想想？', 'cheery'],
        ['rival', '我看别的地方都是这么写的。', 'cheery'],
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
