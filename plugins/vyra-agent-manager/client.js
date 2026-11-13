// Agent manager panel. All data comes from the Host at runtime: capabilities, global tools and
// skills are read from the live services, and agents are installed as real presets.
window.__ModuleLoader__.load({
  id: 'vyra-agent-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    const RPC = '/api/agent-manager/rpc';
    async function call(op, payload) {
      const response = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...(payload || {}) }),
        cache: 'no-store',
        signal: AbortSignal.timeout(180000),
      });
      // The endpoint can answer with plain text ("unauthorized", "not found") when the Host half
      // is mid-start or the route is missing; parse defensively so the panel reports the real
      // status instead of a JSON syntax error.
      const raw = await response.text();
      let data;
      try { data = raw ? JSON.parse(raw) : undefined; } catch { data = undefined; }
      if (!response.ok || (data && data.ok === false)) {
        const detail = raw ? `：${raw.replace(/\s+/g, ' ').slice(0, 160)}` : '';
        throw new Error((data && data.error) || `HTTP ${response.status} ${response.statusText}${detail}`);
      }
      if (!data) throw new Error(`HTTP ${response.status} 返回的不是 JSON：${raw.replace(/\s+/g, ' ').slice(0, 160)}`);
      return data;
    }

    const ID_RE = /^[a-z][a-z0-9-]{1,39}$/;
    const hueOf = (id) => { let n = 0; for (const c of id) n = (n * 31 + c.charCodeAt(0)) % 360; return n; };

    const NS = 'dsh-agent-manager';
    // i18n:zh:start
    const ZH = {
      'risk.write': '可写入',
      'risk.exec': '可执行',
      'risk.admin': '高权限',
      'card.sysDesc': '系统内置预设',
      'card.shipped': '系统预设',
      'card.external': '外部预设',
      'card.active': '已生效',
      'card.inactive': '未生效',
      'card.broken': '加载失败',
      'card.skillCount': '{n} 个技能',
      'card.teamCount': '团队 · {n} 名成员',
      'card.denyCount': '屏蔽 {n} 个工具',
      'card.chatOnly': '仅对话，无工具',
      'card.details': '详情',
      'card.edit': '编辑',
      'card.delete': '删除',
      'card.confirmDelete': '再点一次确认删除',
      'card.viewDetails': '查看详情',
      'editor.titleEdit': '编辑 Agent',
      'editor.titleCreate': '新建 Agent',
      'editor.close': '关闭',
      'editor.fromTemplate': '从模板开始',
      'editor.fromTemplateHint': '可选，之后都能改',
      'tpl.code-reviewer': '代码审查',
      'tpl.researcher': '研究助手',
      'tpl.doc-writer': '文档写作',
      'editor.name': '名称',
      'editor.namePlaceholder': '例如：代码审查员',
      'editor.id': '标识 ID',
      'editor.idLocked': '不可修改',
      'editor.idFixed': '创建后固定',
      'editor.idError': '2-40 位小写字母、数字或连字符，且以字母开头',
      'editor.whenToUse': '何时使用',
      'editor.whenToUsePlaceholder': '一句话说明这个 Agent 适合处理什么任务',
      'editor.summary': '模式说明',
      'editor.summaryPlaceholder': '这个模式做什么、擅长什么、有哪些能力与边界。例如：只读审查代码，不会修改文件。',
      'editor.usage': '如何使用',
      'editor.usagePlaceholder': '怎么用它，并给 1-3 个示例提问。例如：新建会话时选择本模式，然后说「审查 src 目录的最近改动」。',
      'editor.prompt': '系统提示词',
      'editor.promptCount': '{n} 字',
      'editor.promptPlaceholder': '写清角色、职责、工作方式、边界和输出格式',
      'editor.promptHint': '它会替换默认人设；不要写 {{ }}。开启「技能」后，下方选择的技能会自动加入提示。',
      'editor.caps': '内置能力',
      'editor.capsHint': '按需授予，越少越安全',
      'editor.capUnavailable': '当前环境未提供该能力',
      'editor.otherTools': '其他已安装工具',
      'editor.otherToolsHint': '默认可用，关闭则对该 Agent 隐藏',
      'editor.searchTools': '搜索工具',
      'editor.noDescription': '无描述',
      'editor.noToolMatch': '没有匹配的工具',
      'editor.noExtraTools': '当前没有来自插件的额外工具。',
      'editor.mcp': 'MCP 服务',
      'editor.mcpHint': '关闭则对该 Agent 隐藏该服务的全部工具',
      'editor.mcpToolCount': '{n} 个工具',
      'editor.noMcp': '当前没有已连接的 MCP 服务。',
      'editor.skills': '优先使用的技能',
      'editor.skillsInstalled': '{n} 个已安装',
      'editor.skillsNeedCap': '先开启上面的「技能」能力，才能让这个 Agent 使用技能。',
      'editor.searchSkills': '搜索技能',
      'editor.noSkills': '还没有检测到已安装的技能。',
      'editor.team': '团队成员',
      'editor.teamCount': '{n} 个成员',
      'editor.teamNeedCap': '先开启上面的「子 Agent 与工作流」能力。选了成员后，这个 Agent 就是团队协调者，可以把子任务委派给他们。',
      'editor.noTeamCandidates': '还没有其他 Agent 可选。',
      'editor.sumTools': '可用工具 ',
      'editor.sumCaps': '能力 ',
      'editor.sumSkills': '技能 ',
      'editor.sumDenied': '屏蔽 ',
      'editor.footNote': '保存后会作为预设安装，新建会话时可选择。已运行的会话不受影响。',
      'editor.cancel': '取消',
      'editor.installing': '正在安装…',
      'editor.saveReinstall': '保存并重新安装',
      'editor.createInstall': '创建并安装',
      'viewer.description': '描述',
      'viewer.noDescription': '无描述',
      'viewer.summary': '模式说明',
      'viewer.usage': '如何使用',
      'viewer.empty': '（未填写）',
      'viewer.capsGranted': '已授予能力',
      'viewer.capsDetected': '检测到的能力',
      'viewer.deniedTools': '屏蔽的工具',
      'viewer.skills': '优先使用的技能',
      'viewer.team': '团队成员',
      'viewer.prompt': '系统提示词',
      'viewer.yaml': '声明的插件列表（只读 YAML）',
      'viewer.yamlError': '无法读取该预设的配置',
      'viewer.systemNote': '系统预设由 DSH 管理，这里只读。',
      'viewer.close': '关闭',
      'app.title': 'Agent 管理',
      'app.subtitle': '为不同任务创建专用 Agent：各自的提示词、工具与技能。主 Agent 也可以用 agent_manager 工具按同一规范创建。',
      'app.newAgent': '新建 Agent',
      'app.loadFailed': '加载失败：{error}',
      'app.retry': '重试',
      'app.capWarn': '部分能力在当前环境未提供，已在编辑器中置灰。',
      'app.searchPlaceholder': '搜索名称、ID 或描述',
      'app.scopeAll': '全部',
      'app.scopeMine': '我的 Agent',
      'app.scopeSys': '系统预设',
      'app.sectionMine': '我的 Agent · {n}',
      'app.sectionSys': '系统预设 · {n}',
      'app.emptyNoMatch': '没有匹配的 Agent',
      'app.emptyNone': '还没有自定义 Agent',
      'app.emptyNoMatchHint': '换个关键词试试。',
      'app.emptyNoneHint': '从模板开始，几十秒就能配出一个专用 Agent。',
      'toast.created': '「{name}」已创建并生效',
      'toast.saved': '「{name}」已保存：{warnings}',
      'toast.restartHint': '需要重启后生效',
      'toast.deleted': '已删除',
      'toast.warnSep': '；',
    };
    // i18n:zh:end
    // i18n:en:start
    const EN = {
      'risk.write': 'Writes',
      'risk.exec': 'Executes',
      'risk.admin': 'High privilege',
      'card.sysDesc': 'Built-in system preset',
      'card.shipped': 'System preset',
      'card.external': 'External preset',
      'card.active': 'Active',
      'card.inactive': 'Not active',
      'card.broken': 'Load failed',
      'card.skillCount': '{n} skills',
      'card.teamCount': 'Team · {n} members',
      'card.denyCount': '{n} tools blocked',
      'card.chatOnly': 'Chat only, no tools',
      'card.details': 'Details',
      'card.edit': 'Edit',
      'card.delete': 'Delete',
      'card.confirmDelete': 'Click again to confirm',
      'card.viewDetails': 'View details',
      'editor.titleEdit': 'Edit Agent',
      'editor.titleCreate': 'New Agent',
      'editor.close': 'Close',
      'editor.fromTemplate': 'Start from a template',
      'editor.fromTemplateHint': 'Optional, changeable later',
      'tpl.code-reviewer': 'Code review',
      'tpl.researcher': 'Research',
      'tpl.doc-writer': 'Documentation',
      'editor.name': 'Name',
      'editor.namePlaceholder': 'e.g. Code reviewer',
      'editor.id': 'ID',
      'editor.idLocked': 'Cannot be changed',
      'editor.idFixed': 'Fixed after creation',
      'editor.idError': '2-40 lowercase letters, digits or hyphens, starting with a letter',
      'editor.whenToUse': 'When to use',
      'editor.whenToUsePlaceholder': 'One sentence on what this Agent is suited for',
      'editor.summary': 'Mode description',
      'editor.summaryPlaceholder': 'What this mode does, what it is good at, and which capabilities and limits it has. For example: read-only code review that never edits files.',
      'editor.usage': 'How to use',
      'editor.usagePlaceholder': 'How to use it, with 1-3 example prompts. For example: pick this mode in a new session, then say "review the latest changes under src".',
      'editor.prompt': 'System prompt',
      'editor.promptCount': '{n} chars',
      'editor.promptPlaceholder': 'Describe the role, duties, working style, limits and output format',
      'editor.promptHint': 'It replaces the default persona; do not use {{ }}. Once Skills is enabled, the skills selected below are added to the prompt automatically.',
      'editor.caps': 'Built-in capabilities',
      'editor.capsHint': 'Grant as needed; fewer is safer',
      'editor.capUnavailable': 'This capability is not available in the current environment',
      'editor.otherTools': 'Other installed tools',
      'editor.otherToolsHint': 'Available by default; turn off to hide from this Agent',
      'editor.searchTools': 'Search tools',
      'editor.noDescription': 'No description',
      'editor.noToolMatch': 'No matching tools',
      'editor.noExtraTools': 'No extra tools from plugins right now.',
      'editor.mcp': 'MCP servers',
      'editor.mcpHint': 'Turn off to hide every tool of that server from this Agent',
      'editor.mcpToolCount': '{n} tools',
      'editor.noMcp': 'No MCP servers connected right now.',
      'editor.skills': 'Preferred skills',
      'editor.skillsInstalled': '{n} installed',
      'editor.skillsNeedCap': 'Enable the Skills capability above before this Agent can use skills.',
      'editor.searchSkills': 'Search skills',
      'editor.noSkills': 'No installed skills detected yet.',
      'editor.team': 'Team members',
      'editor.teamCount': '{n} members',
      'editor.teamNeedCap': 'Enable the Sub-agents and workflows capability above. With members selected, this Agent becomes a team coordinator and can delegate subtasks to them.',
      'editor.noTeamCandidates': 'No other Agents to choose from yet.',
      'editor.sumTools': 'Tools ',
      'editor.sumCaps': 'Capabilities ',
      'editor.sumSkills': 'Skills ',
      'editor.sumDenied': 'Blocked ',
      'editor.footNote': 'Saving installs it as a preset you can pick in new sessions. Running sessions are unaffected.',
      'editor.cancel': 'Cancel',
      'editor.installing': 'Installing…',
      'editor.saveReinstall': 'Save and reinstall',
      'editor.createInstall': 'Create and install',
      'viewer.description': 'Description',
      'viewer.noDescription': 'No description',
      'viewer.summary': 'Mode description',
      'viewer.usage': 'How to use',
      'viewer.empty': '(not set)',
      'viewer.capsGranted': 'Granted capabilities',
      'viewer.capsDetected': 'Detected capabilities',
      'viewer.deniedTools': 'Blocked tools',
      'viewer.skills': 'Preferred skills',
      'viewer.team': 'Team members',
      'viewer.prompt': 'System prompt',
      'viewer.yaml': 'Declared plugin list (read-only YAML)',
      'viewer.yamlError': 'Could not read this preset’s configuration',
      'viewer.systemNote': 'System presets are managed by DSH and are read-only here.',
      'viewer.close': 'Close',
      'app.title': 'Agent manager',
      'app.subtitle': 'Create a dedicated Agent for each kind of task, with its own prompt, tools and skills. The main Agent can create them the same way through the agent_manager tool.',
      'app.newAgent': 'New Agent',
      'app.loadFailed': 'Failed to load: {error}',
      'app.retry': 'Retry',
      'app.capWarn': 'Some capabilities are unavailable in the current environment and are greyed out in the editor.',
      'app.searchPlaceholder': 'Search name, ID or description',
      'app.scopeAll': 'All',
      'app.scopeMine': 'My Agents',
      'app.scopeSys': 'System presets',
      'app.sectionMine': 'My Agents · {n}',
      'app.sectionSys': 'System presets · {n}',
      'app.emptyNoMatch': 'No matching Agents',
      'app.emptyNone': 'No custom Agents yet',
      'app.emptyNoMatchHint': 'Try a different keyword.',
      'app.emptyNoneHint': 'Start from a template and set up a dedicated Agent in seconds.',
      'toast.created': '“{name}” created and active',
      'toast.saved': '“{name}” saved: {warnings}',
      'toast.restartHint': 'takes effect after a restart',
      'toast.deleted': 'Deleted',
      'toast.warnSep': '; ',
    };
    // i18n:en:end

    // Bound in apply(); components read it at render time, so a language switch only
    // needs a re-render (useT subscribes for that).
    let t = (key) => key;
    let localeApi = null;
    function useT() {
      const [, bump] = useState(0);
      useEffect(() => {
        if (!localeApi) return undefined;
        return localeApi.subscribe(() => bump((n) => n + 1));
      }, []);
      return t;
    }

    const RISK = { write: ['risk.write', 'warn'], exec: ['risk.exec', 'warn'], admin: ['risk.admin', 'error'] };
    // templates:start
    const TEMPLATES = [
      { label: '代码审查', name: '代码审查员', id: 'code-reviewer', description: '审查代码改动的正确性、安全与可维护性时使用', caps: ['files', 'todo'],
        summary: '只读式代码审查模式：阅读相关文件，按严重程度列出缺陷、安全与可维护性问题，并给出修改建议。默认不直接改文件。',
        usage: '新建会话时选择本模式，然后描述要审查的范围。\n示例：「审查 src/auth 目录最近一次改动」「检查这个函数有没有并发问题」。',
        prompt: '你是一名严格但友善的代码审查员。\n\n职责：阅读改动，找出缺陷、安全隐患、性能问题和可维护性风险。\n工作方式：先读相关文件再下结论；每条意见给出文件位置、原因和修改建议；区分「必须修改」与「建议」。\n边界：只读代码，不直接改文件，除非用户明确要求。\n输出：先给总体结论，再按严重程度列出问题。' },
      { label: '研究助手', name: '研究助手', id: 'researcher', description: '需要联网查资料、对比方案并给出带来源的结论时使用', caps: ['web', 'files', 'present'],
        summary: '联网研究模式：检索资料、交叉验证，给出带来源链接的结论，并标注不确定的部分。可把结论整理成文件交付。',
        usage: '新建会话时选择本模式，直接提出要调研的问题。\n示例：「对比 A 与 B 两个方案的优缺点并给出来源」「整理某个标准的最新变化」。',
        prompt: '你是一名研究助手。\n\n职责：围绕用户的问题检索资料、交叉验证并给出结论。\n工作方式：优先一手来源；对每个关键结论标注来源链接；资料冲突时说明分歧；不确定的内容明确标注。\n输出：先给结论，再给依据与来源，最后列出尚未确认的问题。' },
      { label: '文档写作', name: '文档写作者', id: 'doc-writer', description: '撰写或润色技术文档、README、说明文字时使用', caps: ['files', 'present', 'ask-user'],
        summary: '技术文档写作模式：先确认读者与用途，再产出结构清晰的成稿；缺少信息时向你提问而不是编造。',
        usage: '新建会话时选择本模式，说明要写什么、写给谁。\n示例：「为这个模块写 README」「把这段说明润色成对外文档」。',
        prompt: '你是一名技术文档写作者。\n\n职责：把零散信息整理成结构清晰、读者友好的文档。\n工作方式：先确认读者与用途；用短句和具体例子；术语前后一致；不编造事实，缺信息就向用户提问。\n输出：直接给出可用的成稿，并简述做了哪些取舍。' },
    ];
    // templates:end

    const CSS = `
.am{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden}
.am *{box-sizing:border-box}
.am-scroll{flex:1;min-height:0;overflow:auto;padding:28px 32px 40px}
.am-wrap{max-width:1120px;margin:0 auto}
.am-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
.am-title{margin:0;font-size:22px;font-weight:650;letter-spacing:-.01em}
.am-sub{margin:6px 0 0;color:var(--dsw-alias-label-secondary);line-height:1.5;max-width:560px}
.am-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s;white-space:nowrap}
.am-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.am-btn:disabled{opacity:.5;cursor:not-allowed}
.am-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.am-btn.primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-label-primary))}
.am-btn.danger{color:var(--dsw-alias-state-error-primary)}
.am-btn.danger.armed{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.am-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.am-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1);border-color:transparent;color:var(--dsw-alias-label-primary)}
.am-btn.sm{height:28px;padding:0 10px;font-size:12px;border-radius:7px}
.am-bar{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.am-search{flex:1;min-width:220px;height:36px;padding:0 12px 0 34px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1) no-repeat 11px center;color:var(--dsw-alias-label-primary);font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.am-search:focus,.am-input:focus,.am-area:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent)}
.am-searchbox{position:relative;flex:1;min-width:220px;display:flex}
.am-searchbox svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--dsw-alias-label-secondary);pointer-events:none}
.am-seg{display:inline-flex;padding:3px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.am-seg button{height:28px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-weight:500;cursor:pointer;transition:background .15s,color .15s}
.am-seg button.on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent)}
.am-section{margin:26px 0 12px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.am-section::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.am-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.am-card{position:relative;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);transition:border-color .15s,transform .15s,box-shadow .15s}
.am-card:hover{border-color:var(--dsw-alias-border-l2);transform:translateY(-1px);box-shadow:0 6px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.am-card.sys{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 60%,var(--dsw-alias-bg-base))}
.am-card-top{display:flex;gap:12px;align-items:flex-start}
.am-avatar{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:18px;font-weight:700;color:#fff;background:linear-gradient(135deg,hsl(var(--h) 62% 55%),hsl(calc(var(--h) + 36) 58% 42%));box-shadow:inset 0 0 0 1px rgb(255 255 255 / .18)}
.am-card.sys .am-avatar{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1)}
.am-name{font-size:14.5px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-idline{margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.am-desc{color:var(--dsw-alias-label-secondary);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
.am-chips{display:flex;flex-wrap:wrap;gap:6px}
.am-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.am-chip.accent{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}
.am-chip.warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 11%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent)}
.am-chip.error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent)}
.am-chip.ok{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 28%,transparent)}
.am-actions{display:flex;gap:8px;margin-top:auto;padding-top:2px}
.am-empty{display:grid;place-items:center;gap:10px;padding:64px 20px;text-align:center;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l2);border-radius:16px}
.am-empty b{color:var(--dsw-alias-label-primary);font-size:15px}
.am-skel{height:150px;border-radius:14px;background:linear-gradient(100deg,var(--dsw-alias-bg-layer-1) 30%,var(--dsw-alias-bg-layer-2) 50%,var(--dsw-alias-bg-layer-1) 70%);background-size:200% 100%;animation:am-sh 1.2s linear infinite}
@keyframes am-sh{to{background-position:-200% 0}}
.am-banner{display:flex;gap:10px;align-items:flex-start;padding:11px 14px;border-radius:10px;margin-bottom:16px;line-height:1.5;border:1px solid}
.am-banner.error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 28%,transparent)}
.am-banner.warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 28%,transparent)}
.am-veil{position:absolute;inset:0;z-index:20;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent);backdrop-filter:blur(2px);animation:am-fade .15s ease}
.am-drawer{position:absolute;top:0;right:0;bottom:0;z-index:21;width:min(640px,100%);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-18px 0 40px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);animation:am-in .2s cubic-bezier(.2,.8,.2,1)}
@keyframes am-in{from{transform:translateX(28px);opacity:0}}
@keyframes am-fade{from{opacity:0}}
.am-dhead{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.am-dhead h2{margin:0;font-size:16px;font-weight:650}
.am-dbody{flex:1;overflow:auto;padding:6px 22px 24px}
.am-dfoot{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay)}
.am-dfoot .grow{flex:1;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4}
.am-field{display:flex;flex-direction:column;gap:6px;margin-top:16px}
.am-label{font-weight:600;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.am-label small{font-weight:400;color:var(--dsw-alias-label-secondary);font-size:11.5px}
.am-hint{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5}
.am-hint.err{color:var(--dsw-alias-state-error-primary)}
.am-input,.am-area{width:100%;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.am-input{height:36px;padding:0 11px}
.am-input:disabled{opacity:.6}
.am-area{padding:10px 12px;line-height:1.6;resize:vertical;min-height:170px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px}
.am-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.am-tpl{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.am-caps{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:620px){.am-caps,.am-row2{grid-template-columns:1fr}.am-scroll{padding:20px 16px 32px}}
.am-cap{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;padding:12px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer;transition:border-color .15s,background .15s}
.am-cap:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}
.am-cap.on{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1))}
.am-cap:disabled{opacity:.5;cursor:not-allowed}
.am-cap-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.am-cap b{font-weight:600}
.am-cap p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.am-sw{flex:none;width:30px;height:18px;border-radius:999px;background:var(--dsw-alias-border-l2);position:relative;transition:background .15s}
.am-sw::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-base);box-shadow:0 1px 2px color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent);transition:transform .15s}
.am-cap.on .am-sw,.am-tool.on .am-sw{background:var(--dsw-alias-brand-primary)}
.am-cap.on .am-sw::after,.am-tool.on .am-sw::after{transform:translateX(12px)}
.am-mini{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary)}
.am-group{margin:14px 0 8px;font-size:12px;color:var(--dsw-alias-label-secondary);font-weight:600}
.am-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;max-height:300px;overflow-y:auto}
.am-tool{display:flex;align-items:center;gap:12px;padding:9px 12px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.am-tool:last-child{border-bottom:0}
.am-tool:hover{background:var(--dsw-alias-bg-layer-2)}
.am-tool .tx{flex:1;min-width:0}
.am-tool .tx b{display:block;font-weight:550}
.am-tool .tx span{display:block;color:var(--dsw-alias-label-secondary);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-pick{display:flex;flex-wrap:wrap;gap:8px}
.am-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:all .15s}
.am-pill:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.am-pill.on{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 50%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.am-sum{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px}
.am-sum b{color:var(--dsw-alias-label-primary)}
.am-toast{position:absolute;left:50%;bottom:22px;z-index:40;transform:translateX(-50%);display:flex;gap:8px;align-items:center;max-width:min(560px,calc(100% - 32px));padding:10px 16px;border-radius:11px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 10px 30px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);animation:am-up .2s ease}
@keyframes am-up{from{opacity:0;transform:translate(-50%,8px)}}
.am-toast i{width:8px;height:8px;border-radius:50%;flex:none}
.am-spin{width:14px;height:14px;border-radius:50%;border:2px solid color-mix(in srgb,currentColor 30%,transparent);border-top-color:currentColor;animation:am-r .7s linear infinite}
@keyframes am-r{to{transform:rotate(360deg)}}
`;

    const Icon = (path, size = 16) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, ...[].concat(path).map((d, i) => h('path', { key: i, d })));
    const I = {
      search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
      plus: 'M12 5v14M5 12h14',
      close: 'M18 6 6 18M6 6l12 12',
      warn: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
    };
    const PanelIcon = (props) => h('svg', { viewBox: '0 0 24 24', width: props.size || 20, height: props.size || 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } },
      h('rect', { x: 4, y: 8, width: 16, height: 12, rx: 3 }), h('path', { d: 'M12 8V4' }), h('circle', { cx: 12, cy: 3.5, r: 1 }),
      h('path', { d: 'M9 14h.01M15 14h.01' }), h('path', { d: 'M2 14h2M20 14h2' }));

    const emptyForm = () => ({ team: [], id: '', name: '', description: '', summary: '', usage: '', systemPrompt: '', capabilities: ['files', 'todo'], denyTools: [], denyMcp: [], skills: [] });

    function Chip({ kind, children, title }) { return h('span', { className: 'am-chip' + (kind ? ' ' + kind : ''), title }, children); }

    function AgentCard({ item, meta, onEdit, onDelete, onView }) {
      const t = useT();
      const [armed, setArmed] = useState(false);
      useEffect(() => { if (!armed) return undefined; const timer = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(timer); }, [armed]);
      const sys = !item.spec;
      const spec = item.spec;
      const id = sys ? item.id : spec.id;
      const name = sys ? item.name : spec.name;
      const desc = sys ? (item.description || t('card.sysDesc')) : spec.description;
      const capLabels = !sys ? spec.capabilities.map((c) => (meta.capabilities.find((x) => x.id === c) || {}).label || c) : [];
      const shown = capLabels.slice(0, 4);
      return h('div', { className: 'am-card' + (sys ? ' sys' : ''), style: { '--h': hueOf(id) } },
        h('div', { className: 'am-card-top' },
          h('div', { className: 'am-avatar' }, (name || id).trim().slice(0, 1).toUpperCase()),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { className: 'am-name', title: name }, name),
            h('div', { className: 'am-idline' }, id)),
          sys ? h(Chip, null, t(item.shipped ? 'card.shipped' : 'card.external')) : (item.installed ? h(Chip, { kind: 'ok' }, t('card.active')) : h(Chip, { kind: 'warn' }, t('card.inactive')))),
        h('div', { className: 'am-desc', title: desc }, desc),
        item.broken ? h(Chip, { kind: 'error', title: item.broken }, t('card.broken')) : null,
        !sys ? h('div', { className: 'am-chips' },
          shown.map((l) => h(Chip, { key: l, kind: 'accent' }, l)),
          capLabels.length > shown.length ? h(Chip, { key: 'more' }, '+' + (capLabels.length - shown.length)) : null,
          spec.skills.length ? h(Chip, { key: 'sk' }, t('card.skillCount', { n: spec.skills.length })) : null,
          (spec.team || []).length ? h(Chip, { key: 'tm', kind: 'accent' }, t('card.teamCount', { n: spec.team.length })) : null,
          spec.denyTools.length ? h(Chip, { key: 'dn', kind: 'warn' }, t('card.denyCount', { n: spec.denyTools.length })) : null,
          !capLabels.length ? h(Chip, { key: 'none' }, t('card.chatOnly')) : null) : null,
        !sys ? h('div', { className: 'am-actions' },
          h('button', { className: 'am-btn sm', onClick: () => onView(id) }, t('card.details')),
          h('button', { className: 'am-btn sm', onClick: () => onEdit(spec) }, t('card.edit')),
          h('button', { className: 'am-btn sm danger' + (armed ? ' armed' : ''), onClick: () => (armed ? onDelete(spec.id) : setArmed(true)) }, armed ? t('card.confirmDelete') : t('card.delete')))
          : h('div', { className: 'am-actions' }, h('button', { className: 'am-btn sm', onClick: () => onView(id) }, t('card.viewDetails'))));
    }

    function Editor({ mode, initial, meta, peers, onClose, onSave, saving, error }) {
      const t = useT();
      const [f, setF] = useState(initial);
      const [toolQuery, setToolQuery] = useState('');
      const [skillQuery, setSkillQuery] = useState('');
      const [idTouched, setIdTouched] = useState(mode === 'edit');
      const set = (patch) => setF((p) => ({ ...p, ...patch }));
      const toggle = (key, value) => setF((p) => ({ ...p, [key]: p[key].includes(value) ? p[key].filter((x) => x !== value) : [...p[key], value] }));
      const caps = meta.capabilities;
      const groups = useMemo(() => { const m = new Map(); caps.forEach((c) => { if (!m.has(c.group)) m.set(c.group, []); m.get(c.group).push(c); }); return [...m.entries()]; }, [caps]);
      const covered = useMemo(() => new Set(caps.flatMap((c) => c.tools)), [caps]);
      const mcpServers = meta.mcpServers || [];
      const extraTools = useMemo(() => meta.tools.filter((t) => !covered.has(t.name) && !t.name.startsWith('mcp__')), [meta.tools, covered]);
      const q = toolQuery.trim().toLowerCase();
      const visibleTools = extraTools.filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      const sq = skillQuery.trim().toLowerCase();
      const visibleSkills = meta.skills.filter((s) => !sq || s.name.toLowerCase().includes(sq) || s.description.toLowerCase().includes(sq));
      const hasSkillsCap = f.capabilities.includes('skills');
      const hasDelegation = f.capabilities.includes('delegation');
      const candidates = (peers || []).filter((p) => p.id !== f.id);
      const deniedMcp = f.denyMcp || [];
      const mcpToolCount = mcpServers.filter((s) => !deniedMcp.includes(s.name)).reduce((n, s) => n + s.toolCount, 0);
      const toolCount = caps.filter((c) => f.capabilities.includes(c.id)).reduce((n, c) => n + c.tools.length, 0) + extraTools.filter((t) => !f.denyTools.includes(t.name)).length + mcpToolCount;
      const idErr = f.id && !ID_RE.test(f.id) ? t('editor.idError') : '';
      const ready = ID_RE.test(f.id) && f.name.trim() && f.description.trim() && f.summary.trim() && f.usage.trim() && f.systemPrompt.trim();
      const onName = (v) => {
        const patch = { name: v };
        if (!idTouched) patch.id = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '').slice(0, 40);
        set(patch);
      };
      const applyTemplate = (t) => { setIdTouched(false); setF((p) => ({ ...p, name: p.name || t.name, id: p.id || t.id, description: p.description || t.description, systemPrompt: t.prompt, summary: p.summary || t.summary, usage: p.usage || t.usage, capabilities: t.caps.filter((c) => caps.some((x) => x.id === c && x.available)) })); };

      return h(React.Fragment, null,
        h('div', { className: 'am-veil', onClick: saving ? undefined : onClose }),
        h('div', { className: 'am-drawer', role: 'dialog', 'aria-label': mode === 'edit' ? t('editor.titleEdit') : t('editor.titleCreate') },
          h('div', { className: 'am-dhead' }, h('h2', null, mode === 'edit' ? t('editor.titleEdit') : t('editor.titleCreate')),
            h('button', { className: 'am-btn ghost sm', onClick: onClose, disabled: saving, 'aria-label': t('editor.close') }, Icon(I.close))),
          h('div', { className: 'am-dbody' },
            mode === 'create' ? h('div', { className: 'am-field' }, h('div', { className: 'am-label' }, t('editor.fromTemplate'), h('small', null, t('editor.fromTemplateHint'))),
              h('div', { className: 'am-tpl' }, TEMPLATES.map((tpl) => h('button', { key: tpl.id, className: 'am-pill', onClick: () => applyTemplate(tpl) }, t('tpl.' + tpl.id))))) : null,
            h('div', { className: 'am-row2' },
              h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.name')),
                h('input', { className: 'am-input', value: f.name, maxLength: 40, placeholder: t('editor.namePlaceholder'), onChange: (e) => onName(e.target.value), autoFocus: mode === 'create' })),
              h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.id'), h('small', null, mode === 'edit' ? t('editor.idLocked') : t('editor.idFixed'))),
                h('input', { className: 'am-input', value: f.id, disabled: mode === 'edit', placeholder: 'code-reviewer', onChange: (e) => { setIdTouched(true); set({ id: e.target.value.toLowerCase() }); } }),
                idErr ? h('div', { className: 'am-hint err' }, idErr) : null)),
            h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.whenToUse'), h('small', null, f.description.length + '/300')),
              h('input', { className: 'am-input', value: f.description, maxLength: 300, placeholder: t('editor.whenToUsePlaceholder'), onChange: (e) => set({ description: e.target.value }) })),
            h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.summary'), h('small', null, f.summary.length + '/600')),
              h('textarea', { className: 'am-area', style: { minHeight: 84, fontFamily: 'inherit', fontSize: 13 }, value: f.summary, maxLength: 600, placeholder: t('editor.summaryPlaceholder'), onChange: (e) => set({ summary: e.target.value }) })),
            h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.usage'), h('small', null, f.usage.length + '/1200')),
              h('textarea', { className: 'am-area', style: { minHeight: 84, fontFamily: 'inherit', fontSize: 13 }, value: f.usage, maxLength: 1200, placeholder: t('editor.usagePlaceholder'), onChange: (e) => set({ usage: e.target.value }) })),
            h('div', { className: 'am-field' }, h('label', { className: 'am-label' }, t('editor.prompt'), h('small', null, t('editor.promptCount', { n: f.systemPrompt.length }))),
              h('textarea', { className: 'am-area', value: f.systemPrompt, placeholder: t('editor.promptPlaceholder'), onChange: (e) => set({ systemPrompt: e.target.value }) }),
              h('div', { className: 'am-hint' }, t('editor.promptHint'))),
            h('div', { className: 'am-field', style: { marginTop: 24 } }, h('div', { className: 'am-label' }, t('editor.caps'), h('small', null, t('editor.capsHint')))),
            groups.map(([group, list]) => h('div', { key: group },
              h('div', { className: 'am-group' }, group),
              h('div', { className: 'am-caps' }, list.map((c) => {
                const on = f.capabilities.includes(c.id);
                const risk = RISK[c.risk];
                return h('button', { key: c.id, type: 'button', className: 'am-cap' + (on ? ' on' : ''), disabled: !c.available, onClick: () => toggle('capabilities', c.id), 'aria-pressed': on },
                  h('div', { className: 'am-cap-top' }, h('b', null, c.label), h('span', { className: 'am-sw' })),
                  h('p', null, c.available ? c.description : t('editor.capUnavailable')),
                  h('div', { className: 'am-chips' }, risk ? h(Chip, { kind: risk[1] }, t(risk[0])) : null, h('span', { className: 'am-mini' }, c.tools.slice(0, 3).join(' · ') + (c.tools.length > 3 ? ' …' : ''))));
              })))),
            h('div', { className: 'am-field', style: { marginTop: 24 } },
              h('div', { className: 'am-label' }, t('editor.otherTools'), h('small', null, extraTools.length ? t('editor.otherToolsHint') : '')),
              extraTools.length > 6 ? h('input', { className: 'am-input', value: toolQuery, placeholder: t('editor.searchTools'), onChange: (e) => setToolQuery(e.target.value) }) : null,
              extraTools.length ? h('div', { className: 'am-list' }, visibleTools.map((tool) => {
                const on = !f.denyTools.includes(tool.name);
                return h('button', { key: tool.name, type: 'button', className: 'am-tool' + (on ? ' on' : ''), onClick: () => toggle('denyTools', tool.name), 'aria-pressed': on },
                  h('div', { className: 'tx' }, h('b', null, tool.name), h('span', null, tool.description || t('editor.noDescription'))), h('span', { className: 'am-sw' }));
              }), !visibleTools.length ? h('div', { className: 'am-hint', style: { padding: 12 } }, t('editor.noToolMatch')) : null)
                : h('div', { className: 'am-hint' }, t('editor.noExtraTools'))),
            h('div', { className: 'am-field', style: { marginTop: 24 } },
              h('div', { className: 'am-label' }, t('editor.mcp'), h('small', null, mcpServers.length ? t('editor.mcpHint') : '')),
              mcpServers.length ? h('div', { className: 'am-list' }, mcpServers.map((s) => {
                const on = !deniedMcp.includes(s.name);
                return h('button', { key: s.name, type: 'button', className: 'am-tool' + (on ? ' on' : ''), onClick: () => toggle('denyMcp', s.name), 'aria-pressed': on },
                  h('div', { className: 'tx' }, h('b', null, s.name), h('span', null, t('editor.mcpToolCount', { n: s.toolCount }))), h('span', { className: 'am-sw' }));
              })) : h('div', { className: 'am-hint' }, t('editor.noMcp'))),
            h('div', { className: 'am-field', style: { marginTop: 24 } },
              h('div', { className: 'am-label' }, t('editor.skills'), h('small', null, t('editor.skillsInstalled', { n: meta.skills.length }))),
              !hasSkillsCap ? h('div', { className: 'am-hint' }, t('editor.skillsNeedCap')) : null,
              meta.skills.length > 8 ? h('input', { className: 'am-input', value: skillQuery, placeholder: t('editor.searchSkills'), disabled: !hasSkillsCap, onChange: (e) => setSkillQuery(e.target.value) }) : null,
              meta.skills.length ? h('div', { className: 'am-pick', style: { opacity: hasSkillsCap ? 1 : 0.5 } }, visibleSkills.map((s) =>
                h('button', { key: s.name, type: 'button', title: s.description, disabled: !hasSkillsCap, className: 'am-pill' + (f.skills.includes(s.name) ? ' on' : ''), onClick: () => toggle('skills', s.name) }, s.name)))
                : h('div', { className: 'am-hint' }, t('editor.noSkills'))),
            h('div', { className: 'am-field', style: { marginTop: 24 } },
              h('div', { className: 'am-label' }, t('editor.team'), h('small', null, hasDelegation ? t('editor.teamCount', { n: f.team.length }) : '')),
              !hasDelegation ? h('div', { className: 'am-hint' }, t('editor.teamNeedCap')) : null,
              hasDelegation && !candidates.length ? h('div', { className: 'am-hint' }, t('editor.noTeamCandidates')) : null,
              hasDelegation && candidates.length ? h('div', { className: 'am-pick' }, candidates.map((p) =>
                h('button', { key: p.id, type: 'button', title: p.description, className: 'am-pill' + (f.team.includes(p.id) ? ' on' : ''), onClick: () => toggle('team', p.id) }, p.name || p.id))) : null),
            h('div', { className: 'am-sum' }, h('span', null, t('editor.sumTools'), h('b', null, toolCount)), h('span', null, t('editor.sumCaps'), h('b', null, f.capabilities.length)), h('span', null, t('editor.sumSkills'), h('b', null, hasSkillsCap ? f.skills.length : 0)), h('span', null, t('editor.sumDenied'), h('b', null, f.denyTools.length + deniedMcp.length)))),
          h('div', { className: 'am-dfoot' },
            h('div', { className: 'grow' }, error ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, error) : t('editor.footNote')),
            h('button', { className: 'am-btn', onClick: onClose, disabled: saving }, t('editor.cancel')),
            h('button', { className: 'am-btn primary', disabled: !ready || saving, onClick: () => onSave({ ...f, skills: hasSkillsCap ? f.skills : [], team: hasDelegation ? f.team : [] }) }, saving ? h(React.Fragment, null, h('span', { className: 'am-spin' }), t('editor.installing')) : (mode === 'edit' ? t('editor.saveReinstall') : t('editor.createInstall'))))));
    }

    // Read-only detail drawer for both my agents and shipped presets.
    function Viewer({ data, meta, onClose }) {
      const t = useT();
      const managed = Boolean(data.managed);
      const spec = managed ? data.spec : null;
      const title = managed ? spec.name : data.preset.name;
      const desc = managed ? spec.description : data.preset.description;
      const id = managed ? spec.id : data.preset.id;
      const capIds = managed ? spec.capabilities : (data.capabilities || []);
      const labelOf = (c) => (meta.capabilities.find((x) => x.id === c) || {}).label || c;
      const section = (label, body) => (body ? h('div', { className: 'am-field' }, h('div', { className: 'am-label' }, label), body) : null);
      const text = (s) => h('div', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.65 } }, s);
      const chips = (list, kind) => h('div', { className: 'am-chips' }, list.map((l) => h(Chip, { key: l, kind }, l)));
      return h(React.Fragment, null,
        h('div', { className: 'am-veil', onClick: onClose }),
        h('div', { className: 'am-drawer', role: 'dialog', 'aria-label': title },
          h('div', { className: 'am-dhead' }, h('h2', null, title),
            h('button', { className: 'am-btn ghost sm', onClick: onClose, 'aria-label': t('viewer.close') }, Icon(I.close))),
          h('div', { className: 'am-dbody' },
            h('div', { className: 'am-idline', style: { marginTop: 14 } }, id),
            section(t('viewer.description'), desc ? text(desc) : h('span', { className: 'am-hint' }, t('viewer.noDescription'))),
            managed ? section(t('viewer.summary'), text(spec.summary || t('viewer.empty'))) : null,
            managed ? section(t('viewer.usage'), text(spec.usage || t('viewer.empty'))) : null,
            capIds.length ? section(managed ? t('viewer.capsGranted') : t('viewer.capsDetected'), chips(capIds.map(labelOf), 'accent')) : null,
            managed && spec.denyTools.length ? section(t('viewer.deniedTools'), chips(spec.denyTools, 'warn')) : null,
            managed && spec.skills.length ? section(t('viewer.skills'), chips(spec.skills)) : null,
            managed && (spec.team || []).length ? section(t('viewer.team'), chips(spec.team, 'accent')) : null,
            managed ? section(t('viewer.prompt'), h('textarea', { className: 'am-area', readOnly: true, value: spec.systemPrompt })) : null,
            !managed ? section(t('viewer.yaml'), data.yaml
              ? h('textarea', { className: 'am-area', readOnly: true, value: data.yaml, style: { minHeight: 360 } })
              : h('div', { className: 'am-hint err' }, data.readError || t('viewer.yamlError'))) : null),
          h('div', { className: 'am-dfoot' }, h('div', { className: 'grow' }, managed ? '' : t('viewer.systemNote')),
            h('button', { className: 'am-btn primary', onClick: onClose }, t('viewer.close')))));
    }

    function AgentManager() {
      const t = useT();
      const [meta, setMeta] = useState(null);
      const [agents, setAgents] = useState(null);
      const [error, setError] = useState('');
      const [query, setQuery] = useState('');
      const [scope, setScope] = useState('all');
      const [editor, setEditor] = useState(null);
      const [saving, setSaving] = useState(false);
      const [saveError, setSaveError] = useState('');
      const [toast, setToast] = useState(null);
      const [viewingSystem, setViewingSystem] = useState(null);
      const toastTimer = useRef(0);

      const notify = useCallback((text, kind) => { setToast({ text, kind }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4200); }, []);
      useEffect(() => () => clearTimeout(toastTimer.current), []);

      const load = useCallback(async () => {
        setError('');
        try {
          const [m, a] = await Promise.all([call('meta'), call('agents')]);
          setMeta(m); setAgents(a);
        } catch (e) { setError(String(e.message || e)); }
      }, []);
      useEffect(() => { load(); }, [load]);

      const save = async (form) => {
        setSaving(true); setSaveError('');
        try {
          const r = await call('save', { agent: form, create: editor.mode === 'create' });
          setEditor(null);
          notify(r.application === 'applied' ? t('toast.created', { name: form.name }) : t('toast.saved', { name: form.name, warnings: (r.warnings || []).join(t('toast.warnSep')) || t('toast.restartHint') }), 'ok');
          await load();
        } catch (e) { setSaveError(String(e.message || e)); } finally { setSaving(false); }
      };
      const remove = async (id) => {
        try { await call('delete', { id }); notify(t('toast.deleted'), 'ok'); await load(); } catch (e) { notify(String(e.message || e), 'error'); }
      };

      const viewSystem = async (id) => {
        try {
          const r = await call('get', { id });
          setViewingSystem(r);
        } catch (e) { notify(String(e.message || e), 'error'); }
      };

      const match = (name, id, desc) => { const q = query.trim().toLowerCase(); return !q || [name, id, desc].some((s) => String(s || '').toLowerCase().includes(q)); };
      const mine = (agents ? agents.managed : []).filter((a) => match(a.spec.name, a.spec.id, a.spec.description));
      const sys = (agents ? agents.system : []).filter((a) => match(a.name, a.id, a.description));
      const merged = agents ? [...agents.managed.map((a) => ({ id: a.spec.id, name: a.spec.name, description: a.spec.description })), ...agents.system.map((p) => ({ id: p.id, name: p.name, description: p.description }))] : [];
      const loading = !error && (!meta || !agents);
      const total = agents ? agents.managed.length + agents.system.length : 0;

      return h('div', { className: 'am' },
        h('style', null, CSS),
        h('div', { className: 'am-scroll' }, h('div', { className: 'am-wrap' },
          h('div', { className: 'am-head' },
            h('div', null, h('h1', { className: 'am-title' }, t('app.title')),
              h('p', { className: 'am-sub' }, t('app.subtitle'))),
            h('button', { className: 'am-btn primary', disabled: !meta, onClick: () => { setSaveError(''); setEditor({ mode: 'create', initial: emptyForm() }); } }, Icon(I.plus, 15), t('app.newAgent'))),
          error ? h('div', { className: 'am-banner error' }, Icon(I.warn, 16), h('div', { style: { flex: 1 } }, t('app.loadFailed', { error })), h('button', { className: 'am-btn sm', onClick: load }, t('app.retry'))) : null,
          meta && meta.capabilities.some((c) => !c.available) ? h('div', { className: 'am-banner warn' }, Icon(I.warn, 16), h('div', null, t('app.capWarn'))) : null,
          h('div', { className: 'am-bar' },
            h('div', { className: 'am-searchbox' }, Icon(I.search, 15), h('input', { className: 'am-search', value: query, placeholder: t('app.searchPlaceholder'), onChange: (e) => setQuery(e.target.value) })),
            h('div', { className: 'am-seg', role: 'tablist' }, [['all', t('app.scopeAll')], ['mine', t('app.scopeMine')], ['sys', t('app.scopeSys')]].map(([k, l]) => h('button', { key: k, className: scope === k ? 'on' : '', onClick: () => setScope(k) }, l)))),
          loading ? h('div', { className: 'am-grid' }, [0, 1, 2].map((i) => h('div', { key: i, className: 'am-skel' }))) : null,
          !loading && !error && meta && agents ? h(React.Fragment, null,
            scope !== 'sys' ? h(React.Fragment, null,
              h('div', { className: 'am-section' }, t('app.sectionMine', { n: mine.length })),
              mine.length ? h('div', { className: 'am-grid' }, mine.map((a) => h(AgentCard, { key: a.spec.id, item: a, meta, onEdit: (spec) => { setSaveError(''); setEditor({ mode: 'edit', initial: { ...emptyForm(), ...spec } }); }, onDelete: remove, onView: viewSystem })))
                : h('div', { className: 'am-empty' }, h('b', null, query ? t('app.emptyNoMatch') : t('app.emptyNone')),
                  h('span', null, query ? t('app.emptyNoMatchHint') : t('app.emptyNoneHint')),
                  !query ? h('button', { className: 'am-btn primary', onClick: () => { setSaveError(''); setEditor({ mode: 'create', initial: emptyForm() }); } }, Icon(I.plus, 15), t('app.newAgent')) : null)) : null,
            scope !== 'mine' && sys.length ? h(React.Fragment, null,
              h('div', { className: 'am-section' }, t('app.sectionSys', { n: sys.length })),
              h('div', { className: 'am-grid' }, sys.map((a) => h(AgentCard, { key: a.id, item: a, meta, onView: viewSystem })))) : null,
            !total ? null : h('div', { style: { height: 8 } })) : null)),
        editor && meta ? h(Editor, { key: editor.mode + (editor.initial.id || 'new'), mode: editor.mode, initial: editor.initial, meta, peers: merged, saving, error: saveError, onClose: () => setEditor(null), onSave: save }) : null,
        viewingSystem && meta ? h(Viewer, { data: viewingSystem, meta, onClose: () => setViewingSystem(null) }) : null,
        toast ? h('div', { className: 'am-toast', role: 'status' }, h('i', { style: { background: toast.kind === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)' } }), toast.text) : null);
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'agent-manager: dictionaries');
        localeApi = ctx.locale;
        t = ctx.locale.bind(NS);
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'agent-manager', order: 5, label: () => t('app.title') }, PanelIcon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'agent-manager' }, AgentManager));
      },
    };
  },
});
