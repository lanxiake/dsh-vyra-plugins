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
 * ## Continuity: why a line carries a `reply`
 *
 * This used to be five independent shuffled bags, and it showed: a player's
 * "这个需求，两周做不完" could be answered by "我这不是在跟你商量吗", which
 * answers nothing, and the next exchange started from zero. Two people who
 * keep restarting the conversation do not read as an argument.
 *
 * So a line now declares what it answers. `reply: '<id>'` means "this line is
 * the response to that one", and a beat's bag only offers lines whose `reply`
 * names the line currently on screen (or `null`, when any opener will do).
 * The result is a chain, not a shuffle: demand → deflection → counter, in the
 * order they were written.
 *
 * The player and the rival also carry a `stance` — what they are currently
 * arguing. Landing a hit moves the player forward, taking one moves them back,
 * and the lines are tagged with the stances they belong to. That is what makes
 * a round sound like it has a shape instead of a shuffle.
 *
 * Each story keeps its ordered `open` script and a `ko` truce: those two are
 * scenes, not exchanges.
 *
 * ## The beats
 *
 *   open   — the bell rings (an ordered script)
 *   chain  — the player lands three hits in a row
 *   guard  — the player blocks
 *   hit    — a clean heavy lands
 *   take   — the player is knocked down
 *   super  — the finisher
 *   ko     — the opponent goes down (the truce)
 *   taunt  — the opponent's line after it lands something big
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
      /**
       * Each line is `[speaker, text, mood, reply]`. `reply` is the id of the
       * line it answers, or omitted when it can open an exchange.
       */
      chain: [
        { id: 'c1', speaker: 'you', text: '这个按钮放哪，你总得说吧。', mood: 'flat' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '你先按你的理解做。', mood: 'airy' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '我的理解是放首页最上面。', mood: 'dry' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '不行，太显眼了。', mood: 'hard' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '那你说放哪。', mood: 'flat' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '你觉得呢？', mood: 'cheery' },
        // The branch that lands the joke: the player names the evasion.
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '你这叫让我猜。', mood: 'flat' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '大家都是为了把东西做好。', mood: 'cheery' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '那就先把「做好」定义一下。', mood: 'dry' },
        { id: 'c1i', reply: 'c1h', speaker: 'rival', text: '……', mood: 'tired' },
        { id: 'c1j', reply: 'c1i', speaker: 'you', text: '看，又卡住了。', mood: 'flat' },

        { id: 'c2', speaker: 'you', text: '这已经是第三版了。', mood: 'tired' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '第三版好，说明在收敛。', mood: 'cheery' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '收敛到哪儿了？', mood: 'dry' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '收敛到需要第四版。', mood: 'airy' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '那第一版算什么。', mood: 'flat' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '算探索。', mood: 'smooth' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '我两周的探索。', mood: 'tired' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这个真做不了。', mood: 'flat' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '为什么做不了？', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '点一下跳三个页面，逻辑说不通。', mood: 'dry' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '那改两个页面。', mood: 'airy' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '为什么是两个？', mood: 'flat' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '感觉差不多。', mood: 'cheery' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '感觉不是需求文档。', mood: 'dry' },

        { id: 'g2', speaker: 'rival', text: '这里能不能先隐藏，后面再放出来？', mood: 'airy' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '隐藏给谁看？', mood: 'flat' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '给用户看。', mood: 'cheery' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '看不见的东西怎么给用户看。', mood: 'dry' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '这个以后再讨论。', mood: 'smooth' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '「以后」是排期里最忙的一天。', mood: 'flat' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个需求上周刚改过。', mood: 'flat' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '用户反馈嘛。', mood: 'airy' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '哪个用户？', mood: 'dry' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '就……用户。', mood: 'cheery' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '你吧。', mood: 'flat' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '我代表用户。', mood: 'smooth' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '那我代表加班。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '就调一下顺序，很快的。', mood: 'flat' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '对，很快的。', mood: 'cheery' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '上次那个「很快的」用了两周。', mood: 'flat' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '这次真的快。', mood: 'airy' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '上次你也这么说。', mood: 'tired' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '这次我陪你一起加班。', mood: 'cheery' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '……这句我记下了。', mood: 'dry' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '好，我改。', mood: 'tired' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '辛苦了辛苦了。', mood: 'cheery' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '改完要保留旧版吗？', mood: 'flat' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '不用。', mood: 'airy' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '那有人要用旧的怎么办？', mood: 'dry' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '应该不会吧。', mood: 'cheery' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '上线第二天就会出现。', mood: 'tired' },

        { id: 't2', speaker: 'rival', text: '这个改完，还有几个小地方。', mood: 'smooth' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '几个？', mood: 'flat' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '一个清单。', mood: 'cheery' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '清单有几条。', mood: 'dry' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '没数，都在群里。', mood: 'airy' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '群消息也算需求了。', mood: 'tired' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '停，我们先对一遍需求。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '现在？', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '就现在，一条一条来。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……行吧。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '第一条就说不清楚。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '那先跳过第一条。', mood: 'baffled' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……行，是我没说清楚。', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '你现在说清楚就行。', mood: 'warm' },
        { id: 'k1b', reply: 'k1a', speaker: 'rival', text: '那我重新写一版。', mood: 'beaten' },
        { id: 'k1c', reply: 'k1b', speaker: 'you', text: '写完我们再打。', mood: 'warm' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '这很简单的。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '简单你来。', mood: 'dry' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '我要是会我就自己做了。', mood: 'cheery' },

        { id: 'x2', speaker: 'rival', text: '参考一下那个网站。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '参考哪一部分？', mood: 'flat' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '就那个感觉。', mood: 'airy' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '「感觉」不能写进代码。', mood: 'dry' },

        { id: 'x3', speaker: 'rival', text: '先做一个版本给我看。', mood: 'cheery' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '做完你还是会说不对。', mood: 'flat' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '那总得先看。', mood: 'smooth' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '看完说「还是第一版好」。', mood: 'tired' },

        { id: 'x4', speaker: 'rival', text: '什么时候能好？', mood: 'hard' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '你先说清楚要什么。', mood: 'flat' },
        { id: 'x4b', reply: 'x4a', speaker: 'rival', text: '我不是催你。', mood: 'cheery' },
        { id: 'x4c', reply: 'x4b', speaker: 'you', text: '你这句话就是催。', mood: 'dry' },
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
        { id: 'c1', speaker: 'you', text: '你这个接口返回 500。', mood: 'flat' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '那是你传参不对。', mood: 'hard' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '文档就是这么写的。', mood: 'dry' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '文档我更新了。', mood: 'smooth' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '什么时候更新的？', mood: 'flat' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '刚才。', mood: 'cheery' },
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '我照着旧的写完了。', mood: 'dry' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '那你照新的再改一下。', mood: 'airy' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '提前发现问题的是我，不是你。', mood: 'flat' },

        { id: 'c2', speaker: 'you', text: '这个字段是必填还是选填？', mood: 'flat' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '都行。', mood: 'airy' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '都行是哪种行？', mood: 'dry' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '不填也行，填了也行。', mood: 'cheery' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '那你们的校验是干什么的。', mood: 'flat' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '校验是防误用的。', mood: 'smooth' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '现在误用的是我。', mood: 'tired' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这块数据是空的。', mood: 'flat' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '本地有啊。', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '我在线上看的。', mood: 'dry' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '线上环境不一样。', mood: 'smooth' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '那到底哪个算对？', mood: 'flat' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '以线上为准。', mood: 'hard' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '线上是空的。', mood: 'dry' },
        { id: 'g1g', reply: 'g1f', speaker: 'rival', text: '那我看看本地。', mood: 'airy' },

        { id: 'g2', speaker: 'rival', text: '你那边是不是缓存了？', mood: 'smooth' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '我清过了。', mood: 'flat' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '再清一次。', mood: 'airy' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '清第几次才能好？', mood: 'dry' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '这不是缓存的问题。', mood: 'cheery' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '那你刚才让我清什么。', mood: 'flat' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个字段会变。', mood: 'flat' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '不会变。', mood: 'hard' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '上次也是这么说的。', mood: 'dry' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '上次是特殊情况。', mood: 'smooth' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '那这次呢？', mood: 'flat' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '这次是正常情况。', mood: 'cheery' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '正常的定义是「会变」吗。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '字段名能不能改一下。', mood: 'flat' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '不能，前端都在用。', mood: 'hard' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '前端就我一个。', mood: 'dry' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '那更不能随便改。', mood: 'smooth' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '为什么？', mood: 'flat' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '改了我这边要重发。', mood: 'airy' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '所以难的是你，不是我。', mood: 'tired' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '好，我按你说的改。', mood: 'tired' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '对，就这样传。', mood: 'cheery' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '改完还是 500。', mood: 'flat' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '那你看看日志。', mood: 'smooth' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '日志里是你的报错。', mood: 'dry' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '那你先按我的思路排查一下。', mood: 'airy' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '我们是在做项目，还是在互相传话。', mood: 'tired' },

        { id: 't2', speaker: 'rival', text: '我这边测是好的。', mood: 'cheery' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '你测的是哪个环境？', mood: 'flat' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '我本机。', mood: 'airy' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '用户的本机不是你的本机。', mood: 'dry' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '那应该差不多。', mood: 'smooth' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '「差不多」就是我们现在的状态。', mood: 'tired' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '把文档补上，我们从头对。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '现在？', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '就现在，一个字段一个字段。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……好吧。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '第一个字段。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '……这个我也要查一下。', mood: 'baffled' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……行，文档我补。', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '早该补了。', mood: 'warm' },
        { id: 'k1b', reply: 'k1a', speaker: 'rival', text: '下次你先看文档。', mood: 'beaten' },
        { id: 'k1c', reply: 'k1b', speaker: 'you', text: '下次你先把文档写完。', mood: 'warm' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '接口很简单的。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '简单你写个例子。', mood: 'dry' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '例子在你脑子里。', mood: 'cheery' },

        { id: 'x2', speaker: 'rival', text: '这个问题我复现不了。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '我复现了十次。', mood: 'flat' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '那就是你的操作问题。', mood: 'hard' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '我的操作就是点了你的按钮。', mood: 'dry' },

        { id: 'x3', speaker: 'rival', text: '你截图看一下。', mood: 'hard' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '截图里看不到报文。', mood: 'flat' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '那你把报文发我。', mood: 'smooth' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '报文是你的 500。', mood: 'dry' },

        { id: 'x4', speaker: 'rival', text: '文档上写得很清楚。', mood: 'hard' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '哪个文档？', mood: 'flat' },
        { id: 'x4b', reply: 'x4a', speaker: 'rival', text: '就是那个文档。', mood: 'smooth' },
        { id: 'x4c', reply: 'x4b', speaker: 'you', text: '那个文档根本不存在。', mood: 'dry' },
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
        { id: 'c1', speaker: 'you', text: '我按你说的步骤试了十遍。', mood: 'flat' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '那可能是环境。', mood: 'airy' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '同一个环境。', mood: 'dry' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '那就是时机。', mood: 'smooth' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '什么时机？', mood: 'flat' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '你手速快一点。', mood: 'cheery' },
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '我手速快它就坏？', mood: 'dry' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '有可能。', mood: 'airy' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '那用户手速快了怎么办。', mood: 'flat' },

        { id: 'c2', speaker: 'you', text: '这个 bug 是偶现还是必现？', mood: 'flat' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '偶现。', mood: 'airy' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '多久偶现一次。', mood: 'dry' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '看心情。', mood: 'cheery' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '代码没有心情。', mood: 'flat' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '那就是概率。', mood: 'smooth' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '概率也得有个数。', mood: 'dry' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这个改动不能上。', mood: 'flat' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '为什么不能上？', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '影响面太大。', mood: 'dry' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '那我怎么验证？', mood: 'airy' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '验证不了。', mood: 'flat' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '验证不了就是没做。', mood: 'hard' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '验证不了就应该分批上。', mood: 'dry' },

        { id: 'g2', speaker: 'rival', text: '你们测试环境为什么这么慢。', mood: 'smooth' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '因为跑在你们的数据上。', mood: 'flat' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '我们数据有什么问题。', mood: 'hard' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '一百万条脏数据。', mood: 'dry' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '那是真实情况。', mood: 'smooth' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '所以它慢得也很真实。', mood: 'flat' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个 bug 老版本就有。', mood: 'flat' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '那更要修了。', mood: 'hard' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '那它就不是这次引入的。', mood: 'dry' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '所以你们一直没修？', mood: 'hard' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '所以这不是这次的问题。', mood: 'flat' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '都是问题。', mood: 'airy' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '我分得细，你测得细一点。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '这不是我这个改动引起的。', mood: 'flat' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '那就是你上一个改动。', mood: 'hard' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '上一个改动已经上线两周了。', mood: 'dry' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '潜伏期。', mood: 'cheery' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '代码没有潜伏期，人有。', mood: 'flat' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '你这话什么意思。', mood: 'shaken' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '意思是先看日志。', mood: 'dry' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '好，我先加日志。', mood: 'tired' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '加日志能修吗？', mood: 'airy' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '能知道它在哪坏的。', mood: 'flat' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '那多久能修好？', mood: 'hard' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '先知道，再谈修。', mood: 'dry' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '上线前能修好吗？', mood: 'smooth' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '上线时间是谁定的？', mood: 'flat' },

        { id: 't2', speaker: 'rival', text: '要不先上了再说。', mood: 'airy' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '上了出问题谁扛？', mood: 'flat' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '可以回滚。', mood: 'cheery' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '回滚过一次了。', mood: 'dry' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '那就再回滚一次。', mood: 'airy' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '回滚不是方案，是缓刑。', mood: 'tired' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '这一版先别上，先把它复现出来。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '可是时间到了。', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '复现出来再上，我负责修。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……行，我盯着看。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '我们一起看。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '好，我给你倒杯水。', mood: 'warm' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……复现了，是那个空值。', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '好，我改。', mood: 'warm' },
        { id: 'k1b', reply: 'k1a', speaker: 'rival', text: '这次是我没说清。', mood: 'beaten' },
        { id: 'k1c', reply: 'k1b', speaker: 'you', text: '下次直接把日志给我。', mood: 'warm' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '我这边没问题。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '你这边是哪个这边。', mood: 'dry' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '我电脑这边。', mood: 'cheery' },
        { id: 'x1c', reply: 'x1b', speaker: 'you', text: '用户不在你电脑里。', mood: 'flat' },

        { id: 'x2', speaker: 'rival', text: '你重启一下试试。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '我重启三次了。', mood: 'flat' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '那清一下缓存。', mood: 'airy' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '你说的都是「再试一次」。', mood: 'dry' },

        { id: 'x3', speaker: 'rival', text: '这个功能本来就没人用。', mood: 'smooth' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '没人用你为什么测它。', mood: 'flat' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '所以我才测出来。', mood: 'cheery' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '……这句我认。', mood: 'dry' },

        { id: 'x4', speaker: 'rival', text: '我提的这些都是为项目好。', mood: 'cheery' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '我知道。', mood: 'flat' },
        { id: 'x4b', reply: 'x4a', speaker: 'rival', text: '你别往心里去。', mood: 'airy' },
        { id: 'x4c', reply: 'x4b', speaker: 'you', text: '我没往心里去，我往日志里去了。', mood: 'dry' },
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
 * Normalise one authored line into the shape the chooser deals out.
 *
 * Two forms are accepted, because both are readable in source:
 *
 *   `['you', '文本', 'flat']`                 — an opener, no reply target
 *   `{ id, speaker, text, mood, reply }`      — a line that answers `reply`
 */
function parseLine(raw) {
  if (Array.isArray(raw)) {
    const [speaker, text, mood] = raw
    return { id: null, speaker, text, mood, reply: null }
  }
  return {
    id: raw.id ?? null,
    speaker: raw.speaker,
    text: raw.text,
    mood: raw.mood ?? 'flat',
    reply: raw.reply ?? null,
  }
}

/**
 * A bark chooser. One per round.
 *
 * A line is one of two kinds, and the difference is what keeps the argument
 * readable:
 *
 *   - **a THREAD line** (`chain`, `guard`, `hit`, `take`, `taunt`) continues
 *     the argument. It is only offered when its `reply` names the line on
 *     screen, whoever spoke it and whatever beat fired it — so a taunt can
 *     answer the player's chain line, which is what a real argument does. The
 *     speaker is taken from the thread, never from the trigger.
 *
 *   - **a MOMENT line** (`super`, `ko`) is a set piece: the player announcing
 *     the finisher, the truce after a knockout. It must sound like the player
 *     when the player triggered it, so its speaker comes from the BEAT, and it
 *     does not advance the thread — after it, the argument picks up exactly
 *     where it left off.
 *
 * `open` is an ordered script that seeds the thread, so the first fight line
 * answers the last opening line.
 *
 * Every thread line is heard before any repeats: a group that runs out of new
 * lines recycles its own, refusing to lead with the one just spoken.
 */
export function createBarks(story, rng = Math.random) {
  /** The line the next line must answer, or null when an opener is wanted. */
  let awaiting = null
  /** Who spoke `awaiting`; a reply alternates away from this. */
  let awaitingSpeaker = null
  /** Per-group bag state, so a group can recycle without starving another. */
  const bags = new Map()
  const lastSaid = new Map()

  const THREAD_BEATS = ['chain', 'guard', 'hit', 'take', 'taunt']
  const MOMENT_BEATS = ['super', 'ko']

  const openScript = (() => {
    const lines = (story.beats.open ?? []).map(parseLine)
    const start = Math.floor(rng() * Math.max(1, lines.length))
    // A rotation, not a shuffle: any starting point reads as a conversation.
    return lines.slice(start).concat(lines.slice(0, start))
  })()
  let openAt = 0

  /**
   * A moment beat is a script too: each `super` line is one beat of the
   * announcement, in the order written, so the finisher says the same thing
   * every time it matters. A fresh bag per entry is fine here because a round
   * fires each of these at most a few times.
   */
  const momentAt = new Map(MOMENT_BEATS.map((beat) => [beat, 0]))

  /** Every thread line in the story, parsed once, each tagged with its beat. */
  const threadLines = THREAD_BEATS.flatMap((beat) =>
    (story.beats[beat] ?? []).map((raw) => ({ ...parseLine(raw), beat })))
  /** Index by what each line answers. */
  const byTarget = new Map()
  for (const line of threadLines) {
    const key = line.reply ?? '__open__'
    if (!byTarget.has(key)) byTarget.set(key, [])
    byTarget.get(key).push(line)
  }

  /** Shuffle a copy; the bag's tail is what gets popped next. */
  function shuffled(list) {
    const bag = list.slice()
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    return bag
  }

  /** One line from `list`, shuffled per bag key, never repeating the last. */
  function deal(bagKey, list) {
    if (list.length === 0) return null
    let bag = bags.get(bagKey)
    if (!bag || bag.length === 0) {
      // Prefer lines not yet heard this round; recycle only when they run out.
      const heard = lastSaid.get(`${bagKey}:heard`) ?? new Set()
      const fresh = list.filter((line) => !heard.has(line.id))
      bag = shuffled(fresh.length > 0 ? fresh : list)
      for (const line of bag) heard.add(line.id)
      lastSaid.set(`${bagKey}:heard`, heard)
      const recent = lastSaid.get(bagKey)
      if (recent !== undefined && bag.length > 1 && bag[bag.length - 1].id === recent) {
        ;[bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]]
      }
      bags.set(bagKey, bag)
    }
    const line = bag.pop()
    lastSaid.set(bagKey, line.id)
    return line
  }

  /**
   * The thread line that answers `awaiting`, preferring `beat`.
   *
   * Order of preference:
   *   1. an answer to the thread, in the beat that fired (the scene's own
   *      voice: a combo lands and the player answers the taunt with a `chain`
   *      line);
   *   2. an answer to the thread in any beat (the argument continues even when
   *      the trigger is something else);
   *   3. an opener in the firing beat (the thread is finished; start one).
   *
   * Two filters keep it readable: a line never directly follows the same
   * speaker twice in a row, and a line is not repeated until its group has
   * been heard through.
   */
  function nextThreadLine(beat) {
    /** @type {Array<{list: Array<object>, key: string}>} */
    const tries = []
    if (awaiting !== null) {
      const answerHere = (byTarget.get(awaiting) ?? []).filter((line) => line.beat === beat)
      if (answerHere.length > 0) tries.push({ list: answerHere, key: `${beat}:${awaiting}` })
      const answers = (byTarget.get(awaiting) ?? []).filter((line) => line.beat !== beat)
      if (answers.length > 0) tries.push({ list: answers, key: `any:${awaiting}` })
    }
    const openHere = (byTarget.get('__open__') ?? []).filter((line) => line.beat === beat)
    if (openHere.length > 0) tries.push({ list: openHere, key: `${beat}:__open__` })
    const openAny = byTarget.get('__open__') ?? []
    if (openAny.length > 0) tries.push({ list: openAny, key: 'any:__open__' })
    // Last resort: any line in the beat at all, so a beat is never silent.
    const anyHere = threadLines.filter((line) => line.beat === beat)
    if (anyHere.length > 0) tries.push({ list: anyHere, key: `${beat}:*` })

    for (const { list, key } of tries) {
      // Prefer a speaker other than the one who spoke last; fall back only if
      // every candidate is the same voice.
      const alternates = list.filter((line) => line.speaker !== awaitingSpeaker)
      const line = deal(key, alternates.length > 0 ? alternates : list)
      if (line) return line
    }
    return null
  }

  return {
    story,
    /** The line currently awaiting an answer; the tests assert continuity. */
    get awaiting() { return awaiting },
    get awaitingSpeaker() { return awaitingSpeaker },
    /**
     * The next line for `beat`, or null when the story has nothing to say
     * there. Returns `{ speaker, text, mood, id }`.
     */
    next(beat) {
      if (beat === 'open') {
        if (openAt >= openScript.length) return null
        const line = openScript[openAt]
        openAt += 1
        awaiting = line.id
        awaitingSpeaker = line.speaker
        return { speaker: line.speaker, text: line.text, mood: line.mood, id: line.id }
      }

      if (MOMENT_BEATS.includes(beat)) {
        const lines = (story.beats[beat] ?? []).map(parseLine)
        const at = momentAt.get(beat) ?? 0
        if (at >= lines.length) return null
        momentAt.set(beat, at + 1)
        const line = lines[at]
        // A moment does not touch `awaiting`: the argument resumes after it.
        return { speaker: line.speaker, text: line.text, mood: line.mood, id: line.id }
      }

      if (!THREAD_BEATS.includes(beat)) return null
      const line = nextThreadLine(beat)
      if (!line) return null
      awaiting = line.id
      awaitingSpeaker = line.speaker
      return { speaker: line.speaker, text: line.text, mood: line.mood, id: line.id }
    },
  }
}