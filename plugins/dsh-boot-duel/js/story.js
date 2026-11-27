/**
 * The two fighters talk. Loudly.
 *
 * Two people, one project, an argument that has been building for weeks and is
 * finally allowed to land. The shape is the same as it always was — every line
 * answers the last one, nobody is a villain because the joke is at the
 * PROJECT's expense, and the exchange escalates before it ends. What changed
 * is the temperature: this used to be passive-aggressive, and the point of the
 * opening animation is to let some of the week out before the work starts.
 *
 *   - **somebody draws a line.** The old scripts were a sequence of polite
 *     deflections; these ones have lines like 「放屁」 and 「滚蛋」 in them. The
 *     profanity stays at the level a grocery-store quarrel has — 「扯淡」,
 *     「滚蛋」, 「要你干嘛」 — and never becomes an actual slur or obscenity, so
 *     the screenshots can go into a plugin listing.
 *   - **the argument is still about the work.** A loser who is simply wrong is
 *     not funny; a rival who sincerely believes 「大家都想把东西做好」 while
 *     moving the deadline is. Both fighters get roasted.
 *   - **it does NOT end warm.** The knockout is a cold cut: the rival is out of
 *     words, the player gets the last one, and the layer closes. No truce, no
 *     cup of tea. That is the "解压" the round is for — the argument ends
 *     because one side can no longer answer, not because everyone calmed down.
 *
 * ## Continuity: why a line carries a `reply`
 *
 * A line declares what it answers. `reply: '<id>'` means "this line is the
 * response to that one", and a beat's bag only offers lines whose `reply`
 * names the line currently on screen (or `null`, when any opener will do).
 * The result is a chain, not a shuffle: demand → deflection → counter, in the
 * order they were written.
 *
 * `open` and `ko` are scripts, not exchanges: the opening scene, and the cold
 * cut. Everything else is a thread.
 *
 * ## The beats
 *
 *   open   — the bell rings (an ordered script, and it starts angry)
 *   chain  — the player lands three hits in a row
 *   guard  — the player blocks
 *   hit    — a clean heavy lands
 *   take   — the player is knocked down
 *   super  — the finisher
 *   ko     — the opponent goes down (the last word, not a truce)
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
        ['rival', '这需求今天必须上。', 'hard'],
        ['you', '今天？现在几点了你抬头看看。', 'hard'],
        ['rival', '那是你的问题。', 'smooth'],
        ['you', '我的问题？行，那你来做。', 'hard'],
        ['rival', '我要是能做要你干嘛。', 'cheery'],
        ['you', '要我就是来给你擦屁股的？', 'hard'],
        ['rival', '话别说这么难听。', 'smooth'],
        ['you', '我说的是事实，难听的是事实。', 'dry'],
        ['rival', '项目要紧，别的以后再说。', 'cheery'],
        ['you', '哪个项目不是被这句「以后再说」拖死的。', 'hard'],
      ],
      /**
       * Each line is `[speaker, text, mood, reply]`. `reply` is the id of the
       * line it answers, or omitted when it can open an exchange.
       */
      chain: [
        { id: 'c1', speaker: 'you', text: '这个按钮放哪，你今天必须给我一句话。', mood: 'hard' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '你先按你的理解做。', mood: 'smooth' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '我的理解是你在甩锅。', mood: 'hard' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '这是正常的分工。', mood: 'cheery' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '分工是各自负责，不是全推给我。', mood: 'dry' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '你这话就有点过了。', mood: 'hard' },
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '过我？你八点发需求九点要上线，你说我过。', mood: 'hard' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '大家都是为了把东西做好。', mood: 'cheery' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '少拿这句堵我。你把「做好」定义清楚再说。', mood: 'hard' },
        { id: 'c1i', reply: 'c1h', speaker: 'rival', text: '……', mood: 'shaken' },
        { id: 'c1j', reply: 'c1i', speaker: 'you', text: '怎么，又卡住了？', mood: 'dry' },

        { id: 'c2', speaker: 'you', text: '这已经是第三版了，你知道吗。', mood: 'hard' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '第三版好，说明在收敛。', mood: 'cheery' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '收敛？你连要什么都说不出来。', mood: 'hard' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '所以要看第四版。', mood: 'smooth' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '那第一版算什么，算我白干？', mood: 'hard' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '算探索，探索是有价值的。', mood: 'airy' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '我两周的探索，你一句「再改改」就抹了。', mood: 'hard' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这个真做不了，你别再问了。', mood: 'hard' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '为什么做不了？', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '因为你不是在提需求，你是在许愿。', mood: 'dry' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '那你说怎么才能做。', mood: 'hard' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '给我三周，或者给我三个人。', mood: 'flat' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '都没有。', mood: 'airy' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '那就别说「做不了」。', mood: 'hard' },

        { id: 'g2', speaker: 'rival', text: '这里能不能先隐藏，后面再放出来？', mood: 'airy' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '隐藏给谁看？给鬼看？', mood: 'hard' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '给用户看。', mood: 'cheery' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '看不见的东西怎么给用户看，你倒是说说。', mood: 'dry' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '这个以后再讨论。', mood: 'smooth' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '「以后」是排期里最忙的一天，你比我清楚。', mood: 'hard' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个需求上周刚改过，你忘了？', mood: 'hard' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '用户反馈嘛。', mood: 'airy' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '哪个用户？说名字。', mood: 'hard' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '就……用户。', mood: 'cheery' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '就是我吧。你自己想改就说是用户想改。', mood: 'hard' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '我代表用户。', mood: 'smooth' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '你代表不了谁，你只代表你自己的 kpi。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '「就调一下顺序，很快的」——你上次也这么说。', mood: 'hard' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '这次真的很快。', mood: 'cheery' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '上次那个「很快的」用了两周，你记得吗？', mood: 'hard' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '情况不一样。', mood: 'smooth' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '哪次都不一样，每次都一样地烂尾。', mood: 'hard' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '这次我陪你一起加班。', mood: 'cheery' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '你陪？你十点准时回家，我记着呢。', mood: 'dry' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '行，我改。但这是最后一版。', mood: 'hard' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '改完要保留旧版吗？', mood: 'airy' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '你不是说不用吗？', mood: 'hard' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '现在想想还是留着好。', mood: 'cheery' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '那你早说啊，我删都删了。', mood: 'hard' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '那就恢复一下。', mood: 'airy' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '恢复？你说得跟喝水一样轻松。', mood: 'dry' },

        { id: 't2', speaker: 'rival', text: '这个改完，还有几个小地方。', mood: 'smooth' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '几个？你现在就给我数。', mood: 'hard' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '一个清单。', mood: 'cheery' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '清单几条？', mood: 'hard' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '没数，都在群里。', mood: 'airy' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '群消息也算需求，那我的加班算不算排期？', mood: 'dry' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '停。现在，我们一条一条对需求。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '现在？时间来不及……', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '来不及的是你。坐下。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……行。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '第一条，你自己念一遍。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '……这条能不能先跳过。', mood: 'baffled' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '说啊，怎么不说了。', mood: 'dry' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '这很简单的。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '简单你来做啊。', mood: 'hard' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '我要是会我就自己做了。', mood: 'cheery' },

        { id: 'x2', speaker: 'rival', text: '参考一下那个网站。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '参考哪一部分？说具体。', mood: 'hard' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '就那个感觉。', mood: 'airy' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '感觉不能写进代码，你懂不懂。', mood: 'hard' },

        { id: 'x3', speaker: 'rival', text: '先做一个版本给我看。', mood: 'cheery' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '做完你还是会说不对，我赌一包烟。', mood: 'hard' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '那总得先看。', mood: 'smooth' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '看完说「还是第一版好」，我等着。', mood: 'dry' },

        { id: 'x4', speaker: 'rival', text: '什么时候能好？', mood: 'hard' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '你先说清楚要什么。', mood: 'hard' },
        { id: 'x4b', reply: 'x4a', speaker: 'rival', text: '我不是催你。', mood: 'cheery' },
        { id: 'x4c', reply: 'x4b', speaker: 'you', text: '你这句话就是催，别装了。', mood: 'hard' },
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
        ['rival', '接口给你了，自己看。', 'flat'],
        ['you', '文档呢？你连文档都没有？', 'hard'],
        ['rival', '接口就是文档。', 'smooth'],
        ['you', '字段没注释，我猜着接？', 'hard'],
        ['rival', '字段名就是注释。', 'cheery'],
        ['you', 'data2_new 是什么意思，你倒是说说。', 'hard'],
        ['rival', '……就是第二个 data 的新版。', 'smooth'],
        ['you', '那 data2_old 呢？你在拿我练手？', 'hard'],
        ['rival', '你先接，我在改。', 'airy'],
        ['you', '改完字段名也变吧？你敢说不变？', 'hard'],
      ],
      chain: [
        { id: 'c1', speaker: 'you', text: '你这个接口返回 500，解释一下。', mood: 'hard' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '那是你传参不对。', mood: 'hard' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '文档就是这么写的，你还想赖？', mood: 'hard' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '文档我更新了。', mood: 'smooth' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '什么时候更新的？刚才？', mood: 'hard' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '刚才。', mood: 'cheery' },
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '我照着旧的写完的，你知道吗？', mood: 'hard' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '那你照新的改一下。', mood: 'airy' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '凭什么每次都是我去改，你一个字不动？', mood: 'hard' },

        { id: 'c2', speaker: 'you', text: '这字段必填还是选填，给句准话。', mood: 'hard' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '都行。', mood: 'airy' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '都行是哪种行？你说清楚。', mood: 'hard' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '不填也行，填了也行。', mood: 'cheery' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '那你们校验是干嘛的？摆设？', mood: 'hard' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '校验是防误用的。', mood: 'smooth' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '现在误用的就是我，你说这算不算你的锅。', mood: 'hard' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这块数据是空的，别跟我说本地有。', mood: 'hard' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '本地有啊。', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '我在线上看的，睁眼说瞎话。', mood: 'hard' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '线上环境不一样。', mood: 'smooth' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '那到底哪个算对？给个准数。', mood: 'hard' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '以线上为准。', mood: 'hard' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '线上是空的。你听见自己说什么了吗？', mood: 'hard' },

        { id: 'g2', speaker: 'rival', text: '你那边是不是缓存了？', mood: 'smooth' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '我清过了，第三次了。', mood: 'hard' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '再清一次。', mood: 'airy' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '清到第几次你才肯看代码？', mood: 'hard' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '这不是缓存的问题。', mood: 'cheery' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '那你刚才让我清什么，耍我玩？', mood: 'hard' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个字段会变，你敢说不会？', mood: 'hard' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '不会变。', mood: 'hard' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '上次也是这么说的，忘了？', mood: 'hard' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '上次是特殊情况。', mood: 'smooth' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '那这次呢？又是特殊情况？', mood: 'hard' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '这次是正常情况。', mood: 'cheery' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '正常的意思是「会变」，你这词用得真行。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '字段名改一下，就一处。', mood: 'hard' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '不能，前端都在用。', mood: 'hard' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '前端就我一个，你拿谁挡？', mood: 'hard' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '那更不能随便改。', mood: 'smooth' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '为什么？说理由，别说「不能」。', mood: 'hard' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '改了我这边要重发。', mood: 'airy' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '所以难的是你，不是我。早说啊。', mood: 'dry' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '行，我按你说的改。改完还是 500 你负责。', mood: 'hard' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '对，就这样传。', mood: 'cheery' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '改完还是 500。', mood: 'hard' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '那你看看日志。', mood: 'smooth' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '日志里是你的报错，你倒是看看。', mood: 'hard' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '那你先按我的思路排查一下。', mood: 'airy' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '我们是在做项目，还是在互相传话？', mood: 'hard' },

        { id: 't2', speaker: 'rival', text: '我这边测是好的。', mood: 'cheery' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '你测的是哪个环境？说。', mood: 'hard' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '我本机。', mood: 'airy' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '用户的本机不是你的本机。', mood: 'hard' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '那应该差不多。', mood: 'smooth' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '「差不多」就是我们线上那个 500。', mood: 'hard' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '把文档补上。现在。从头对。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '现在？写文档很慢的……', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '那就慢。你写，我盯着。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……好吧。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '第一个字段，写。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '……这个我也要查一下。', mood: 'baffled' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '文档呢？写啊。', mood: 'dry' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '接口很简单的。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '简单你写个例子，现在。', mood: 'hard' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '例子在你脑子里。', mood: 'cheery' },

        { id: 'x2', speaker: 'rival', text: '这个问题我复现不了。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '我复现了十次，你要不要看记录？', mood: 'hard' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '那就是你的操作问题。', mood: 'hard' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '我的操作就是点了你的按钮。', mood: 'hard' },

        { id: 'x3', speaker: 'rival', text: '你截图看一下。', mood: 'hard' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '截图里看不到报文，你自己清楚。', mood: 'hard' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '那你把报文发我。', mood: 'smooth' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '报文是你的 500，你还要我发给你？', mood: 'hard' },

        { id: 'x4', speaker: 'rival', text: '文档上写得很清楚。', mood: 'hard' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '哪个文档？你拿出来。', mood: 'hard' },
        { id: 'x4b', reply: 'x4a', speaker: 'rival', text: '就是那个文档。', mood: 'smooth' },
        { id: 'x4c', reply: 'x4b', speaker: 'you', text: '那个文档根本不存在，你编吧。', mood: 'hard' },
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
        ['rival', '这个版本有个问题。', 'hard'],
        ['you', '什么问题？说清楚。', 'hard'],
        ['rival', '偶现。', 'airy'],
        ['you', '偶现是多久一次？给个数。', 'hard'],
        ['rival', '不知道，就是会出现。', 'smooth'],
        ['you', '出现的时候什么样，你总知道吧？', 'hard'],
        ['rival', '……反正不对。', 'cheery'],
        ['you', '「反正不对」，你让我修什么？', 'hard'],
        ['rival', '你们开发最懂了。', 'airy'],
        ['you', '我们最懂的是它在你这儿才坏。', 'dry'],
      ],
      chain: [
        { id: 'c1', speaker: 'you', text: '我按你说的步骤试了十遍，你先解释。', mood: 'hard' },
        { id: 'c1a', reply: 'c1', speaker: 'rival', text: '那可能是环境。', mood: 'airy' },
        { id: 'c1b', reply: 'c1a', speaker: 'you', text: '同一个环境，你还能赖到哪去？', mood: 'hard' },
        { id: 'c1c', reply: 'c1b', speaker: 'rival', text: '那就是时机。', mood: 'smooth' },
        { id: 'c1d', reply: 'c1c', speaker: 'you', text: '什么时机？说人话。', mood: 'hard' },
        { id: 'c1e', reply: 'c1d', speaker: 'rival', text: '你手速快一点。', mood: 'cheery' },
        { id: 'c1f', reply: 'c1e', speaker: 'you', text: '我手速快它就坏？你听听这像话吗。', mood: 'hard' },
        { id: 'c1g', reply: 'c1f', speaker: 'rival', text: '有可能。', mood: 'airy' },
        { id: 'c1h', reply: 'c1g', speaker: 'you', text: '那用户手速快了怎么办，把锅甩给用户？', mood: 'hard' },

        { id: 'c2', speaker: 'you', text: '这个 bug 偶现还是必现，一句话。', mood: 'hard' },
        { id: 'c2a', reply: 'c2', speaker: 'rival', text: '偶现。', mood: 'airy' },
        { id: 'c2b', reply: 'c2a', speaker: 'you', text: '多久一次？别跟我说不清楚。', mood: 'hard' },
        { id: 'c2c', reply: 'c2b', speaker: 'rival', text: '看心情。', mood: 'cheery' },
        { id: 'c2d', reply: 'c2c', speaker: 'you', text: '代码没有心情。你是在逗我吗？', mood: 'hard' },
        { id: 'c2e', reply: 'c2d', speaker: 'rival', text: '那就是概率。', mood: 'smooth' },
        { id: 'c2f', reply: 'c2e', speaker: 'you', text: '概率也得有个数，你的数是编的。', mood: 'hard' },
      ],
      guard: [
        { id: 'g1', speaker: 'you', text: '这个改动不能上，我说了算。', mood: 'hard' },
        { id: 'g1a', reply: 'g1', speaker: 'rival', text: '为什么不能上？', mood: 'hard' },
        { id: 'g1b', reply: 'g1a', speaker: 'you', text: '影响面太大，你比我清楚。', mood: 'hard' },
        { id: 'g1c', reply: 'g1b', speaker: 'rival', text: '那我怎么验证？', mood: 'airy' },
        { id: 'g1d', reply: 'g1c', speaker: 'you', text: '验证不了就别证了。', mood: 'hard' },
        { id: 'g1e', reply: 'g1d', speaker: 'rival', text: '验证不了就是没做。', mood: 'hard' },
        { id: 'g1f', reply: 'g1e', speaker: 'you', text: '你这句话说得轻巧，出事谁扛？', mood: 'hard' },

        { id: 'g2', speaker: 'rival', text: '你们测试环境为什么这么慢。', mood: 'smooth' },
        { id: 'g2a', reply: 'g2', speaker: 'you', text: '因为跑在你们的数据上。', mood: 'hard' },
        { id: 'g2b', reply: 'g2a', speaker: 'rival', text: '我们数据有什么问题。', mood: 'hard' },
        { id: 'g2c', reply: 'g2b', speaker: 'you', text: '一百万条脏数据，这叫没问题？', mood: 'hard' },
        { id: 'g2d', reply: 'g2c', speaker: 'rival', text: '那是真实情况。', mood: 'smooth' },
        { id: 'g2e', reply: 'g2d', speaker: 'you', text: '好，那它慢得也很真实。别怪环境。', mood: 'dry' },
      ],
      hit: [
        { id: 'h1', speaker: 'you', text: '这个 bug 老版本就有，别往我身上推。', mood: 'hard' },
        { id: 'h1a', reply: 'h1', speaker: 'rival', text: '那更要修了。', mood: 'hard' },
        { id: 'h1b', reply: 'h1a', speaker: 'you', text: '那就不是这次引入的，你听懂了吗？', mood: 'hard' },
        { id: 'h1c', reply: 'h1b', speaker: 'rival', text: '所以你们一直没修？', mood: 'hard' },
        { id: 'h1d', reply: 'h1c', speaker: 'you', text: '所以这不是这次的问题。别偷换。', mood: 'hard' },
        { id: 'h1e', reply: 'h1d', speaker: 'rival', text: '都是问题。', mood: 'airy' },
        { id: 'h1f', reply: 'h1e', speaker: 'you', text: '我分得细，你也测得细一点。', mood: 'dry' },

        { id: 'h2', speaker: 'you', text: '这不是我这个改动引起的，看日志。', mood: 'hard' },
        { id: 'h2a', reply: 'h2', speaker: 'rival', text: '那就是你上一个改动。', mood: 'hard' },
        { id: 'h2b', reply: 'h2a', speaker: 'you', text: '上一个改动已经上线两周了。', mood: 'hard' },
        { id: 'h2c', reply: 'h2b', speaker: 'rival', text: '潜伏期。', mood: 'cheery' },
        { id: 'h2d', reply: 'h2c', speaker: 'you', text: '代码没有潜伏期，人有。你听懂了吗？', mood: 'hard' },
        { id: 'h2e', reply: 'h2d', speaker: 'rival', text: '你这话什么意思。', mood: 'shaken' },
        { id: 'h2f', reply: 'h2e', speaker: 'you', text: '意思是先看日志，别猜。', mood: 'dry' },
      ],
      take: [
        { id: 't1', speaker: 'you', text: '行，我先加日志。但别指望它今晚出结果。', mood: 'hard' },
        { id: 't1a', reply: 't1', speaker: 'rival', text: '加日志能修吗？', mood: 'airy' },
        { id: 't1b', reply: 't1a', speaker: 'you', text: '能知道它在哪坏的，你急什么。', mood: 'hard' },
        { id: 't1c', reply: 't1b', speaker: 'rival', text: '那多久能修好？', mood: 'hard' },
        { id: 't1d', reply: 't1c', speaker: 'you', text: '先知道，再谈修。你别催。', mood: 'hard' },
        { id: 't1e', reply: 't1d', speaker: 'rival', text: '上线前能修好吗？', mood: 'smooth' },
        { id: 't1f', reply: 't1e', speaker: 'you', text: '上线时间是谁定的？你说。', mood: 'hard' },

        { id: 't2', speaker: 'rival', text: '要不先上了再说。', mood: 'airy' },
        { id: 't2a', reply: 't2', speaker: 'you', text: '上了出问题谁扛？你扛吗？', mood: 'hard' },
        { id: 't2b', reply: 't2a', speaker: 'rival', text: '可以回滚。', mood: 'cheery' },
        { id: 't2c', reply: 't2b', speaker: 'you', text: '回滚过一次了，忘了？', mood: 'hard' },
        { id: 't2d', reply: 't2c', speaker: 'rival', text: '那就再回滚一次。', mood: 'airy' },
        { id: 't2e', reply: 't2d', speaker: 'you', text: '回滚不是方案，是缓刑。我们不是赌徒。', mood: 'hard' },
      ],
      super: [
        { id: 's1', speaker: 'you', text: '这一版先别上。现在，把它复现出来。', mood: 'hard' },
        { id: 's1a', reply: 's1', speaker: 'rival', text: '可是时间到了……', mood: 'surprised' },
        { id: 's1b', reply: 's1a', speaker: 'you', text: '时间到了就把坏的推上去？坐下。', mood: 'hard' },
        { id: 's1c', reply: 's1b', speaker: 'rival', text: '……行，我盯着看。', mood: 'shaken' },
        { id: 's1d', reply: 's1c', speaker: 'you', text: '我们一起看。看它什么时候坏。', mood: 'hard' },
        { id: 's1e', reply: 's1d', speaker: 'rival', text: '……我先把日志开开。', mood: 'warm' },
      ],
      ko: [
        { id: 'k1', speaker: 'rival', text: '……', mood: 'beaten' },
        { id: 'k1a', reply: 'k1', speaker: 'you', text: '日志呢？现在贴出来。', mood: 'dry' },
      ],
      taunt: [
        { id: 'x1', speaker: 'rival', text: '我这边没问题。', mood: 'airy' },
        { id: 'x1a', reply: 'x1', speaker: 'you', text: '你这边是哪个这边？说清楚。', mood: 'hard' },
        { id: 'x1b', reply: 'x1a', speaker: 'rival', text: '我电脑这边。', mood: 'cheery' },
        { id: 'x1c', reply: 'x1b', speaker: 'you', text: '用户不在你电脑里，懂吗。', mood: 'hard' },

        { id: 'x2', speaker: 'rival', text: '你重启一下试试。', mood: 'smooth' },
        { id: 'x2a', reply: 'x2', speaker: 'you', text: '我重启三次了。', mood: 'hard' },
        { id: 'x2b', reply: 'x2a', speaker: 'rival', text: '那清一下缓存。', mood: 'airy' },
        { id: 'x2c', reply: 'x2b', speaker: 'you', text: '你说的都是「再试一次」，这叫修 bug？', mood: 'hard' },

        { id: 'x3', speaker: 'rival', text: '这个功能本来就没人用。', mood: 'smooth' },
        { id: 'x3a', reply: 'x3', speaker: 'you', text: '没人用你为什么测它？', mood: 'hard' },
        { id: 'x3b', reply: 'x3a', speaker: 'rival', text: '所以我才测出来。', mood: 'cheery' },
        { id: 'x3c', reply: 'x3b', speaker: 'you', text: '……这句我认，但你还是得给日志。', mood: 'dry' },

        { id: 'x4', speaker: 'rival', text: '我提的这些都是为项目好。', mood: 'cheery' },
        { id: 'x4a', reply: 'x4', speaker: 'you', text: '我知道，但你别拿这个压我。', mood: 'hard' },
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
 *     the finisher, the last word after a knockout. It must sound like the
 *     player when the player triggered it, so its speaker comes from the BEAT,
 *     and it does not advance the thread — after it, the argument picks up
 *     exactly where it left off.
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
    /**
     * In order, from the top. This used to be rotated to a random start so
     * consecutive rounds did not feel identical, but the script is a SCENE:
     * its replies only mean anything after the line they answer. Starting at
     * 「我这边测是好的。」 leaves the player watching an argument they walked
     * into halfway, and the promise that "every line answers the last one"
     * quietly fails on the very first line.
     */
    return (story.beats.open ?? []).map(parseLine)
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
    /** How many `open` lines this story has; the arena drains them all. */
    get openLineCount() { return openScript.length },
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