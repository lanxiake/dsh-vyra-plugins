// Client half: browser UI for skill & MCP management
window.__ModuleLoader__.load({
  id: 'vyra-skill-mcp-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    const RPC = '/api/dsh-market/rpc';

    // QQ 交流群二维码，内联避免依赖 host 静态路由。
    const QQ_GROUP_IMG = 'data:image/png;base64,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';

    function useDebounce(value, delay) {
      const [debouncedValue, setDebouncedValue] = useState(value);
      useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
      }, [value, delay]);
      return debouncedValue;
    }

    function useInfiniteScroll(callback, hasMore) {
      const observerRef = useRef(null);
      const loadingRef = useRef(false);
      
      const lastElementRef = useCallback((node) => {
        if (loadingRef.current) return;
        if (observerRef.current) observerRef.current.disconnect();
        
        observerRef.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
            loadingRef.current = true;
            callback().finally(() => { loadingRef.current = false; });
          }
        });
        
        if (node) observerRef.current.observe(node);
      }, [callback, hasMore]);
      
      return lastElementRef;
    }

    async function call(op, payload, signal) {
      const response = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...(payload || {}) }),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: signal || AbortSignal.timeout(90000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      if (!text || text === 'not found' || text === 'unauthorized') {
        throw new Error(`服务端返回: ${text || '空响应'}`);
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`解析响应失败: ${text.substring(0, 100)}`);
      }
      
      if (data.ok === false) {
        throw new Error(data.error || '操作失败');
      }
      
      return data;
    }

    // SVG Icons
    const CheckIcon = ({ size = 12 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('polyline', { points: '20 6 9 17 4 12' })
    );

    const SearchIcon = ({ size = 16 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('circle', { cx: '11', cy: '11', r: '8' }),
      h('path', { d: 'M21 21l-4.35-4.35' })
    );

    const PackageIcon = ({ size = 16 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }),
      h('polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }),
      h('line', { x1: '12', y1: '22.08', x2: '12', y2: '12' })
    );

    const PlugIcon = ({ size = 16 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M12 2v4' }),
      h('path', { d: 'M12 18v4' }),
      h('path', { d: 'M4.93 4.93l2.83 2.83' }),
      h('path', { d: 'M16.24 16.24l2.83 2.83' }),
      h('path', { d: 'M2 12h4' }),
      h('path', { d: 'M18 12h4' }),
      h('path', { d: 'M4.93 19.07l2.83-2.83' }),
      h('path', { d: 'M16.24 7.76l2.83-2.83' })
    );

    const XIcon = ({ size = 16 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
      h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
    );

    const ExternalIcon = ({ size = 14 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
      h('polyline', { points: '15 3 21 3 21 9' }),
      h('line', { x1: '10', y1: '14', x2: '21', y2: '3' })
    );

    const CopyIcon = ({ size = 14 }) => h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' }),
      h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
    );

    function formatCount(n) {
      const v = Number(n) || 0;
      if (v >= 10000) return (v / 10000).toFixed(1) + '万';
      if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
      return String(v);
    }

    async function post(url, body, signal) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: signal || AbortSignal.timeout(60000),
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error(`HTTP ${response.status}: ${text.slice(0, 80) || '空响应'}`); }
      return data;
    }

    // ---- SKILL.md rendering (no innerHTML: everything is a React element) ----
    function parseFrontmatter(text) {
      const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
      if (!m) return { meta: {}, body: text };
      const meta = {};
      for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
      }
      return { meta, body: text.slice(m[0].length) };
    }

    const MD = {
      code: { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '0.92em', padding: '1px 5px', borderRadius: '4px', background: 'var(--dsw-alias-bg-layer-2)' },
      link: { color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none' },
      pre: { margin: '10px 0', padding: '12px 14px', borderRadius: '8px', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)', overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '12.5px', lineHeight: 1.55, whiteSpace: 'pre' },
      p: { margin: '8px 0', lineHeight: 1.7 },
      li: { margin: '3px 0', lineHeight: 1.65 },
      quote: { margin: '8px 0', padding: '4px 12px', borderLeft: '3px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)' },
    };

    function renderInline(text, base) {
      const out = [];
      const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
      let last = 0;
      let m;
      let i = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const key = base + '-' + (i++);
        if (m[1]) out.push(h('code', { key, style: MD.code }, m[1].slice(1, -1)));
        else if (m[2]) out.push(h('strong', { key }, m[2].slice(2, -2)));
        else out.push(h('a', { key, href: m[4], target: '_blank', rel: 'noopener noreferrer', style: MD.link }, m[3].slice(1, m[3].indexOf(']'))));
        last = m.index + m[0].length;
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    }

    function renderMarkdown(body) {
      const lines = body.split(/\r?\n/).slice(0, 900);
      const blocks = [];
      let i = 0;
      let k = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (/^```/.test(line)) {
          const buf = [];
          i++;
          while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
          i++;
          blocks.push(h('pre', { key: 'b' + (k++), style: MD.pre }, buf.join('\n')));
        } else if (/^#{1,6}\s/.test(line)) {
          const level = /^#+/.exec(line)[0].length;
          const size = [22, 18, 16, 15, 14, 13][level - 1];
          blocks.push(h('div', { key: 'b' + (k++), role: 'heading', style: { fontSize: size + 'px', fontWeight: 700, margin: (level <= 2 ? '18px' : '12px') + ' 0 6px', color: 'var(--dsw-alias-label-primary)' } }, renderInline(line.replace(/^#+\s*/, ''), 'h' + k)));
          i++;
        } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
          const items = [];
          const ordered = /^\s*\d+\./.test(line);
          while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
            items.push(h('li', { key: 'l' + i, style: MD.li }, renderInline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''), 'li' + i)));
            i++;
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: 'b' + (k++), style: { margin: '6px 0', paddingLeft: '22px' } }, items));
        } else if (/^>\s?/.test(line)) {
          const buf = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
          blocks.push(h('div', { key: 'b' + (k++), style: MD.quote }, renderInline(buf.join(' '), 'q' + k)));
        } else if (line.trim() === '') {
          i++;
        } else {
          const buf = [];
          while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{1,6}\s|>\s?|\s*([-*]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++]);
          blocks.push(h('p', { key: 'b' + (k++), style: MD.p }, renderInline(buf.join(' '), 'p' + k)));
        }
      }
      return blocks;
    }

    function PreviewModal({ view, onClose, onInstall, onUninstall, busy }) {
      const { item, loading, error, data, installed } = view;
      const [mode, setMode] = useState('rendered');
      const [copied, setCopied] = useState(false);

      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      const parsed = useMemo(() => (data && data.content ? parseFrontmatter(data.content) : null), [data]);
      const title = item.name || item.slug;
      const description = (parsed && parsed.meta.description) || item.description || '';
      const link = (data && data.url) || item.homepage || '';
      const slug = item.slug;
      const isBusy = busy.includes(slug);
      const chip = (text) => h('span', { key: text, style: { padding: '2px 10px', borderRadius: '12px', fontSize: '12px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-secondary)', border: '1px solid var(--dsw-alias-border-l1)' } }, text);
      const chips = [
        item.sourceLabel || item.source,
        item.owner,
        item.installs ? `${formatCount(item.installs)} 次安装` : null,
        item.downloads ? `${formatCount(item.downloads)} 下载` : null,
        item.category,
        item.version ? `v${item.version}` : null,
      ].filter(Boolean).map(chip);

      const copy = async () => {
        try {
          await navigator.clipboard.writeText((data && data.content) || '');
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch (e) { /* clipboard unavailable */ }
      };

      return h('div', {
        role: 'dialog',
        'aria-label': title,
        onClick: onClose,
        style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
      },
        h('div', {
          onClick: (e) => e.stopPropagation(),
          style: { width: 'min(860px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--dsw-alias-bg-base)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' },
        },
          h('div', { style: { padding: '18px 22px 14px', borderBottom: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' } },
            h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px' } },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '18px', fontWeight: 700, color: 'var(--dsw-alias-label-primary)', wordBreak: 'break-word' } }, title),
                description && h('div', { style: { marginTop: '6px', fontSize: '13px', lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, description)
              ),
              h('button', { 'aria-label': '关闭', title: '关闭', onClick: onClose, style: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--dsw-alias-label-secondary)', padding: '4px' } }, h(XIcon, { size: 18 }))
            ),
            chips.length > 0 && h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' } }, chips)
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            h('button', { style: S.chip(mode === 'rendered'), onClick: () => setMode('rendered') }, '预览'),
            h('button', { style: S.chip(mode === 'source'), onClick: () => setMode('source') }, '源码'),
            h('div', { style: { flex: 1 } }),
            data && data.content && h('button', { style: { ...S.btn('default', false), flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }, onClick: copy }, h(CopyIcon), copied ? '已复制' : '复制'),
            link && h('a', { href: link, target: '_blank', rel: 'noopener noreferrer', style: { ...S.btn('default', false), flex: 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' } }, h(ExternalIcon), '来源页')
          ),
          h('div', { style: { flex: 1, overflow: 'auto', padding: '8px 22px 18px', minHeight: '180px', color: 'var(--dsw-alias-label-primary)', fontSize: '14px' } },
            loading ? h('div', { style: S.loading }, '正在读取 SKILL.md ...') :
            error ? h('div', { style: { ...S.empty, height: 'auto', padding: '40px 0' } },
              h('span', null, error),
              link && h('a', { href: link, target: '_blank', rel: 'noopener noreferrer', style: MD.link }, '到来源页查看')
            ) :
            mode === 'source' ? h('pre', { style: { ...MD.pre, margin: '10px 0' } }, data.content) :
            h('div', null,
              renderMarkdown(parsed ? parsed.body : ''),
              h('div', { style: { marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--dsw-alias-border-l1)' } },
                h('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.7 } },
                  '有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。'),
                QQ_GROUP_IMG && h('img', {
                  src: QQ_GROUP_IMG,
                  alt: 'QQ 交流群二维码，群号 1121362543',
                  style: { width: '180px', marginTop: '10px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)' },
                })
              )
            )
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 22px', borderTop: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' } },
            h('span', { style: { flex: 1, fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (data && data.path) || ''),
            h('button', { style: { ...S.btn('default', false), flex: 'none' }, onClick: onClose }, '关闭'),
            installed ?
              h('button', { style: { ...S.btn('danger', isBusy), flex: 'none' }, disabled: isBusy, onClick: () => onUninstall(slug) }, isBusy ? '处理中...' : '卸载') :
              h('button', { style: { ...S.btn('primary', isBusy), flex: 'none' }, disabled: isBusy, onClick: () => onInstall(item) }, isBusy ? '安装中...' : '安装')
          )
        )
      );
    }

    // Styles
    const S = {
      container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--dsw-alias-bg-base)',
        overflow: 'hidden',
      },
      header: {
        display: 'flex',
        gap: '2px',
        borderBottom: '2px solid var(--dsw-alias-border-l1)',
        paddingBottom: '0',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      tab: (active) => ({
        padding: '12px 24px',
        border: 'none',
        borderBottom: active ? '3px solid var(--dsw-alias-brand-primary)' : '3px solid transparent',
        background: active ? 'var(--dsw-alias-bg-base)' : 'transparent',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
        fontSize: '14px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        top: '2px',
      }),
      mainContent: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      },
      sidebar: {
        width: '180px',
        flexShrink: 0,
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRight: '1px solid var(--dsw-alias-border-l1)',
        padding: '16px 12px',
        overflow: 'auto',
      },
      sidebarTitle: {
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-secondary)',
        textTransform: 'uppercase',
        marginBottom: '12px',
        letterSpacing: '0.5px',
      },
      categoryItem: (active) => ({
        padding: '8px 12px',
        borderRadius: '6px',
        background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        marginBottom: '4px',
        transition: 'all 0.15s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }),
      categoryCount: {
        fontSize: '11px',
        color: 'var(--dsw-alias-label-secondary)',
        fontWeight: 500,
      },
      rightPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      },
      toolbar: {
        padding: '16px 20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-base)',
        flexWrap: 'wrap',
      },
      searchBox: {
        flex: '0 1 280px',
        minWidth: '160px',
        position: 'relative',
      },
      searchInput: {
        boxSizing: 'border-box',
        width: '100%',
        padding: '8px 12px 8px 36px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border 0.2s',
      },
      searchIcon: {
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      filterChips: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      },
      chip: (active) => ({
        padding: '6px 14px',
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
        borderRadius: '20px',
        background: active ? 'var(--dsw-alias-brand-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }),
      statsBar: {
        padding: '12px 20px',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      statBold: {
        fontWeight: 700,
        color: 'var(--dsw-alias-brand-primary)',
        marginRight: '4px',
      },
      content: {
        flex: 1,
        overflow: 'auto',
        padding: '20px',
      },
      list: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '14px',
        alignContent: 'start',
      },
      listItem: {
        padding: '14px',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minHeight: '150px',
        transition: 'all 0.2s',
        cursor: 'pointer',
        position: 'relative',
      },
      statusDot: (installed, enabled) => ({
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0,
        background: installed && enabled !== false ? 'var(--dsw-alias-state-success-primary)' : 
                   installed ? 'var(--dsw-alias-label-secondary)' : 
                   'transparent',
        border: installed ? 'none' : '1px solid var(--dsw-alias-border-l1)',
      }),
      itemContent: {
        flex: 1,
        minWidth: 0,
      },
      itemHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '6px',
      },
      itemName: {
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)',
        lineHeight: 1.35,
        wordBreak: 'break-word',
      },
      installedBadge: {
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        background: 'var(--dsw-alias-state-success-primary)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      },
      itemDesc: {
        fontSize: '13px',
        color: 'var(--dsw-alias-label-secondary)',
        lineHeight: 1.5,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      },
      itemMeta: {
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginTop: 'auto',
      },
      itemActions: {
        display: 'flex',
        gap: '8px',
        marginTop: 'auto',
        paddingTop: '10px',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      btn: (variant, disabled) => ({
        padding: '6px 16px',
        border: variant === 'primary' ? 'none' : '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '6px',
        background: variant === 'primary' ? 'var(--dsw-alias-brand-primary)' : 
                   variant === 'danger' ? 'transparent' : 'transparent',
        color: variant === 'primary' ? '#fff' : 
               variant === 'danger' ? 'var(--dsw-alias-state-error-primary)' : 
               'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }),
      loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '14px',
      },
      loadingMore: {
        padding: '20px',
        textAlign: 'center',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
      },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        height: '200px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '14px',
      },
      notice: (type) => ({
        margin: '0 20px 16px',
        padding: '12px 16px',
        borderRadius: '8px',
        background: type === 'error' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-bg-layer-2)',
        border: type === 'error' ? 'none' : '1px solid var(--dsw-alias-border-l1)',
        color: type === 'error' ? '#fff' : 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
        lineHeight: '1.5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }),
      closeBtn: {
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        opacity: 0.7,
      },
      jsonArea: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '170px',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        fontSize: '12.5px',
        lineHeight: 1.5,
        resize: 'vertical',
        outline: 'none',
      },
      usageTag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        padding: '1px 7px',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
    };

    function SkillMcpManager() {
      const [tab, setTab] = useState('my-skills');
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      
      const [skills, setSkills] = useState([]);
      const [mcps, setMcps] = useState([]);
      const [installed, setInstalled] = useState([]);
      const [mounted, setMounted] = useState([]);
      
      const [searchQuery, setSearchQuery] = useState('');
      const debouncedQuery = useDebounce(searchQuery, 500);
      
      // skillhub first: measured ~0.3s from CN, while skills.sh takes ~10s here.
      const [source, setSource] = useState('skillhub');
      const [mcpSource, setMcpSource] = useState('registry');
      
      const [category, setCategory] = useState('all');
      const [disabledSkills, setDisabledSkills] = useState([]);
      
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);
      const [loadingMore, setLoadingMore] = useState(false);
      
      const [busy, setBusy] = useState('');
      const abortControllerRef = useRef(null);
      
      const [previewView, setPreviewView] = useState(null);

      // upload / manual config / custom market
      const dirInputRef = useRef(null);
      const [showMcpForm, setShowMcpForm] = useState(false);
      const [mcpForm, setMcpForm] = useState({ serverName: '', transport: 'stdio', command: '', args: '', url: '', env: '' });
      const [customSkillMarket, setCustomSkillMarket] = useState('');
      const [customMcpMarket, setCustomMcpMarket] = useState('');
      const [customItems, setCustomItems] = useState(null);
      const [dropActive, setDropActive] = useState(false);
      const [showJsonForm, setShowJsonForm] = useState(false);
      const [jsonText, setJsonText] = useState('');
      const [jsonEditName, setJsonEditName] = useState('');
      const [usage, setUsage] = useState({ tools: {}, skills: {}, mcp: {} });
      const [toolInfo, setToolInfo] = useState({ tools: [], servers: {}, disabled: [] });
      const [expandedServers, setExpandedServers] = useState(() => new Set());
      const [configEditor, setConfigEditor] = useState(null);

      const isMySkills = tab === 'my-skills';
      const isMyMcp = tab === 'my-mcp';
      const isSkillMarket = tab === 'skill-market';
      const isMcpMarket = tab === 'mcp-market';
      const isMarket = isSkillMarket || isMcpMarket;

      const loadInstalled = useCallback(async () => {
        try {
          const [s, m, cfg] = await Promise.all([call('skills.list'), call('mcp.list'), call('settings.get')]);
          setInstalled((s && s.items) || []);
          setMounted((m && m.items) || []);
          // skills.list has no enabled flag; the market plugin keeps disabled slugs in settings.
          const disabled = cfg && cfg.settings && Array.isArray(cfg.settings.disabledSkills) ? cfg.settings.disabledSkills : [];
          setDisabledSkills(disabled.map((x) => String(x).toLowerCase()));
        } catch (e) {
          console.error('加载已安装列表失败:', e);
        }
        try {
          const u = await post('/api/skill-mcp-manager/usage', {}, AbortSignal.timeout(15000));
          if (u && u.ok && u.usage) setUsage(u.usage);
        } catch (e) {
          /* usage is optional */
        }
      }, []);

      const loadTools = useCallback(async () => {
        try {
          const r = await post('/api/skill-mcp-manager/tools', {}, AbortSignal.timeout(20000));
          if (r && r.ok) setToolInfo({ tools: r.tools || [], servers: r.servers || {}, disabled: r.disabled || [] });
        } catch (e) {
          /* tool catalog is optional */
        }
      }, []);

      const toggleTool = useCallback(async (name, enabled) => {
        setBusy(`tool:${name}`);
        setError('');
        try {
          const r = await post('/api/skill-mcp-manager/tools/toggle', { name, enabled }, AbortSignal.timeout(20000));
          if (!r.ok) throw new Error(r.error || '切换失败');
          const rows = r.tools || [];
          const servers = {};
          for (const t of rows) {
            const b = servers[t.server] || { count: 0, tokens: 0, disabled: 0 };
            b.count += 1; b.tokens += t.tokens; if (t.disabled) b.disabled += 1;
            servers[t.server] = b;
          }
          setToolInfo({ tools: rows, servers, disabled: r.disabled || [] });
        } catch (e) {
          setError(`切换工具失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      }, []);

      const openConfigFile = useCallback(async (path) => {
        if (!path) { setError('找不到 MCP 配置文件路径'); return; }
        setError('');
        try {
          const r = await post('/api/skill-mcp-manager/mcp-config', { action: 'read', path }, AbortSignal.timeout(20000));
          if (!r.ok) throw new Error(r.error || '读取失败');
          setConfigEditor({ path: r.path, text: r.content, busy: false, error: '' });
        } catch (e) {
          setError(`读取配置文件失败: ${e.message || e}`);
        }
      }, []);

      const saveConfigFile = useCallback(async () => {
        if (!configEditor) return;
        setConfigEditor({ ...configEditor, busy: true, error: '' });
        try {
          const r = await post('/api/skill-mcp-manager/mcp-config', { action: 'write', path: configEditor.path, content: configEditor.text }, AbortSignal.timeout(20000));
          if (!r.ok) throw new Error(r.error || '保存失败');
          setNotice('配置文件已保存，切换一次开关或重连后生效');
          setConfigEditor(null);
          await loadInstalled();
          await loadTools();
        } catch (e) {
          setConfigEditor({ ...configEditor, busy: false, error: String(e.message || e) });
        }
      }, [configEditor, loadInstalled, loadTools]);

      const openDir = useCallback(async (item, kind) => {
        setError('');
        try {
          const payload = kind === 'mcp'
            ? { kind: 'mcp-item', serverName: item.serverName || item.slug }
            : { kind: 'skill', slug: item.slug };
          const r = await call('market.openDir', payload);
          setNotice(`已打开：${r.opened || ''}`);
        } catch (e) {
          setError(`打开目录失败: ${e.message || e}`);
        }
      }, []);

      // Drag & drop: a folder becomes files[], a .zip is sent as base64 for the host to unpack.
      const handleDrop = useCallback(async (dt) => {
        setDropActive(false);
        if (!dt) return;
        setBusy('drop');
        setError('');
        setNotice('');
        try {
          const files = Array.from(dt.files || []);
          const zip = files.find(f => /\.zip$/i.test(f.name || ''));
          if (zip) {
            const buf = await zip.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 8192) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
            }
            const r = await post('/api/skill-mcp-manager/import-zip', { zipBase64: btoa(bin), name: zip.name.replace(/\.zip$/i, '') }, AbortSignal.timeout(180000));
            if (!r.ok) throw new Error(r.error || '导入失败');
            setNotice(`已从 ${zip.name} 安装技能 ${r.slug}`);
            await loadInstalled();
            return;
          }
          if (files.length === 0 && !(dt.items && dt.items.length)) throw new Error('没有读到文件，请拖入文件夹或 .zip');
          const entries = [];
          const read = async (entry, prefix) => {
            if (entry.isFile) {
              const file = await new Promise((res, rej) => entry.file(res, rej));
              const text = await file.text();
              entries.push({ path: prefix + entry.name, content: text });
            } else if (entry.isDirectory) {
              const reader = entry.createReader();
              const children = await new Promise((res) => reader.readEntries(res, () => res([])));
              for (const child of children) await read(child, prefix + entry.name + '/');
            }
          };
          for (const item of Array.from(dt.items || [])) {
            const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
            if (entry) await read(entry, '');
          }
          if (entries.length === 0) throw new Error('没有读到文件，请拖入文件夹或 .zip');
          const r = await call('skills.upload', { files: entries, force: true });          const n = (r.items && r.items.length) || r.count || 0;
          setNotice(n > 0 ? `已上传 ${n} 个技能` : '没有找到可安装的技能（需要 SKILL.md）');
          await loadInstalled();
        } catch (e) {
          setError(`导入失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      }, [loadInstalled]);

      const importMcpJson = useCallback(async () => {
        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch (e) {
          setError('JSON 解析失败，请检查格式');
          return;
        }
        const servers = parsed.mcpServers && typeof parsed.mcpServers === 'object' ? parsed.mcpServers
          : (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null);
        if (!servers || Object.keys(servers).length === 0) {
          setError('JSON 里没有 mcpServers 内容');
          return;
        }
        setBusy('json-import');
        setError('');
        setNotice('');
        try {
          if (jsonEditName) {
            const def = servers[jsonEditName] || servers.mcpServers?.[jsonEditName] || servers;
            const patch = {};
            for (const key of ['command', 'args', 'url', 'headers', 'env', 'transport']) {
              if (def[key] !== undefined) patch[key] = def[key];
            }
            await call('mcp.update', { serverName: jsonEditName, patch });
            setNotice(`已更新 MCP ${jsonEditName}`);
            setJsonEditName('');
            setJsonText('');
          } else {
            const done = [];
            const failures = [];
            for (const [serverName, def] of Object.entries(servers)) {
              if (!def || typeof def !== 'object') { failures.push(`${serverName}: 定义不是对象`); continue; }
              const payload = { serverName, transport: def.transport || (def.url ? 'streamable-http' : 'stdio') };
              if (def.command) payload.command = String(def.command);
              if (Array.isArray(def.args)) payload.args = def.args.map(String);
              if (def.url) payload.url = String(def.url);
              if (def.headers && typeof def.headers === 'object') payload.headers = def.headers;
              if (def.env && typeof def.env === 'object') payload.env = def.env;
              try {
                const r = await call('mcp.install', payload);
                const first = (r.results && r.results[0]) || {};
                if (first.ok) done.push(serverName);
                else failures.push(`${serverName}: ${first.error || (first.missing && `缺少 ${first.missing.join(',')}`) || '连接失败'}`);
              } catch (e) {
                failures.push(`${serverName}: ${e.message || e}`);
              }
            }
            setNotice(done.length ? `已导入 ${done.length} 个 MCP${failures.length ? `，${failures.length} 个失败` : ''}` : '');
            if (failures.length) setError(failures.join('；'));
            if (done.length) { setJsonText(''); setShowJsonForm(false); }
          }
          await loadInstalled();
        } catch (e) {
          setError(`操作失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      }, [jsonText, jsonEditName, loadInstalled]);

      const editMcpJson = useCallback(async (item) => {
        setError('');
        try {
          const d = await call('mcp.detail', { serverName: item.serverName || item.slug });
          const def = (d && (d.definition || d.item || d)) || {};
          const shape = { command: def.command, args: def.args, url: def.url, headers: def.headers, env: def.env, transport: def.transport };
          const clean = Object.fromEntries(Object.entries(shape).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)));
          setJsonEditName(item.serverName || item.slug);
          setJsonText(JSON.stringify({ mcpServers: { [item.serverName || item.slug]: clean } }, null, 2));
          setShowJsonForm(true);
          setShowMcpForm(false);
        } catch (e) {
          setError(`读取 MCP 定义失败: ${e.message || e}`);
        }
      }, []);

      const searchSkills = useCallback(async (query, opts = {}) => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        
        const isLoadMore = opts.loadMore;
        const targetPage = opts.page || 1;
        
        if (!isLoadMore) {
          setLoading(true);
          setSkills([]);
        } else {
          setLoadingMore(true);
        }
        setError('');
        
        try {
          const result = await call('skills.search', {
            query: query || '',
            source: opts.source || source,
            category: opts.category && opts.category !== 'all' ? opts.category : '',
            page: targetPage,
            pageSize: 24,
          }, abortControllerRef.current.signal);
          
          const items = (result && result.items) || [];
          
          if (isLoadMore) {
            setSkills(prev => [...prev, ...items]);
          } else {
            setSkills(items);
          }
          
          setHasMore(Boolean(result && result.hasMore));
          setPage(targetPage);
          
          if (result && result.hint) {
            setNotice(result.hint);
          } else {
            setNotice('');
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            setError(String(e.message || e));
          }
        } finally {
          setLoading(false);
          setLoadingMore(false);
        }
      }, [source]);

      const searchMcps = useCallback(async (query, opts = {}) => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        
        const isLoadMore = opts.loadMore;
        const targetPage = opts.page || 1;
        
        if (!isLoadMore) {
          setLoading(true);
          setMcps([]);
        } else {
          setLoadingMore(true);
        }
        setError('');
        
        try {
          const result = await call('mcp.search', {
            query: query || '',
            source: opts.source || mcpSource,
            category: opts.category && opts.category !== 'all' ? opts.category : '',
            page: targetPage,
            size: 24,
          }, abortControllerRef.current.signal);
          
          const items = (result && result.items) || [];
          
          if (isLoadMore) {
            setMcps(prev => [...prev, ...items]);
          } else {
            setMcps(items);
          }
          
          const lobehub = (opts.source || mcpSource) === 'lobehub';
          setHasMore(lobehub ? (result && result.page < result.totalPages) : Boolean(result && result.hasMore));
          setPage(targetPage);
          
          if (result && result.hint) {
            setNotice(result.hint);
          } else {
            setNotice('');
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            setError(String(e.message || e));
          }
        } finally {
          setLoading(false);
          setLoadingMore(false);
        }
      }, [mcpSource]);

      const loadMore = useCallback(() => {
        if (loading || loadingMore || !hasMore || customItems) return Promise.resolve();
        
        const nextPage = page + 1;
        if (isSkillMarket) {
          return searchSkills(debouncedQuery, { loadMore: true, page: nextPage, category, source });
        } else if (isMcpMarket) {
          return searchMcps(debouncedQuery, { loadMore: true, page: nextPage, category, source: mcpSource });
        }
        return Promise.resolve();
      }, [tab, isSkillMarket, isMcpMarket, page, hasMore, loading, loadingMore, debouncedQuery, category, source, mcpSource, searchSkills, searchMcps, customItems]);

      const lastElementRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

      useEffect(() => {
        loadInstalled();
      }, [loadInstalled]);

      useEffect(() => {
        if (isMyMcp) loadTools();
      }, [isMyMcp, loadTools]);

      // Live status polling: re-read installed lists (and the MCP tool catalog) every 5s
      // while a "my" tab is open, so mounted/connected changes show up without a reload.
      useEffect(() => {
        if (!isMySkills && !isMyMcp) return;
        const id = setInterval(() => {
          if (busy) return;
          loadInstalled();
          if (isMyMcp) loadTools();
        }, 5000);
        return () => clearInterval(id);
      }, [tab, busy, isMySkills, isMyMcp, loadInstalled, loadTools]);

      // webkitdirectory must be an attribute (React won't render it from props reliably),
      // otherwise the "folder picker" opens a plain file dialog instead.
      useEffect(() => {
        const input = dirInputRef.current;
        if (!input) return;
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
      }, [isMySkills]);

      useEffect(() => {
        if (isSkillMarket) {
          setCategory('all');
          setPage(1);
          setHasMore(true);
          if (!customSkillMarket) searchSkills(debouncedQuery);
        } else if (isMcpMarket) {
          setCategory('all');
          setPage(1);
          setHasMore(true);
          if (!customMcpMarket) searchMcps(debouncedQuery);
        }
      }, [tab, debouncedQuery, source, mcpSource]);

      // Load a user-supplied market URL through our own host route (browser CORS).
      const loadCustomMarket = useCallback(async () => {
        const url = isSkillMarket ? customSkillMarket : customMcpMarket;
        if (!url) {
          setCustomItems(null);
          return;
        }
        setLoading(true);
        setError('');
        try {
          const r = await post('/api/skill-mcp-manager/custom-market', { kind: isSkillMarket ? 'skill' : 'mcp', url }, AbortSignal.timeout(60000));
          if (!r.ok) throw new Error(r.error || '读取市场失败');
          setCustomItems(r.items || []);
          setNotice(`已从自定义市场读取 ${(r.items || []).length} 个条目`);
        } catch (e) {
          setCustomItems(null);
          setError(String(e.message || e));
        } finally {
          setLoading(false);
        }
      }, [isSkillMarket, customSkillMarket, customMcpMarket]);

      useEffect(() => {
        if (isMarket && (customSkillMarket || customMcpMarket)) loadCustomMarket();
        if (isMarket && !customSkillMarket && !customMcpMarket) setCustomItems(null);
      }, [customSkillMarket, customMcpMarket, isMarket, loadCustomMarket]);

      const handleCategoryChange = useCallback((cat) => {
        // Categories are derived from the already-loaded page, so filtering is local:
        // no refetch, no page reset.
        setCategory(cat);
      }, []);

      const installSkill = async (item) => {
        const key = item.slug || item.id;
        setBusy(`install:${key}`);
        setError('');
        try {
          await call('skills.install', {
            source: item.source || 'github',
            reference: item.source === 'skills.sh' ? item.homepage : 
                       item.source === 'clawhub' ? item.installRef :
                       item.upstreamUrl || item.id || item.slug,
            name: item.slug || '',
          });
          setNotice(`技能 ${item.name || key} 安装成功！`);
          await loadInstalled();
          if (isSkillMarket && !customItems) searchSkills(debouncedQuery, { category, source });
        } catch (e) {
          setError(`安装失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const uninstallSkill = async (slug) => {
        setBusy(`uninstall:${slug}`);
        setError('');
        try {
          await call('skills.uninstall', { slug });
          setNotice(`技能已卸载`);
          await loadInstalled();
          if (isSkillMarket && !customItems) searchSkills(debouncedQuery, { category, source });
        } catch (e) {
          setError(`卸载失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const installMcp = async (item) => {
        const key = item.slug || item.id;
        setBusy(`install:${key}`);
        setError('');
        try {
          const result = await call('mcp.install', { slug: item.slug });
          const r = (result.results && result.results[0]) || {};
          if (r.missing && r.missing.length) {
            setError(`需要环境变量: ${r.missing.join(', ')}`);
          } else if (r.ok) {
            setNotice(`MCP ${item.name} 安装成功！工具数: ${r.toolCount || 0}`);
          } else {
            setError(`安装失败: ${r.error || '未知错误'}`);
          }
          await loadInstalled();
          if (isMcpMarket && !customItems) searchMcps(debouncedQuery, { category, source: mcpSource });
        } catch (e) {
          setError(`安装失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const uninstallMcp = async (serverName) => {
        setBusy(`uninstall:${serverName}`);
        setError('');
        try {
          await call('mcp.uninstall', { serverName });
          setNotice(`MCP 已卸载`);
          await loadInstalled();
          if (isMcpMarket && !customItems) searchMcps(debouncedQuery, { category, source: mcpSource });
        } catch (e) {
          setError(`卸载失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const toggleSkill = async (slug, enabled) => {
        setBusy(`toggle:${slug}`);
        setError('');
        try {
          await call('skills.toggle', { slug, enabled });
          setNotice(enabled ? '技能已启用' : '技能已禁用');
          await loadInstalled();
        } catch (e) {
          setError(`切换失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const toggleMcp = async (serverName, enabled) => {
        setBusy(`toggle:${serverName}`);
        setError('');
        try {
          await call('mcp.toggle', { serverName, enabled });
          setNotice(enabled ? 'MCP 已启用' : 'MCP 已禁用');
          await loadInstalled();
        } catch (e) {
          setError(`切换失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      // Click-through picker: the browser file input carries webkitdirectory so the OS opens a
      // folder chooser; every selected file is posted as skills.upload's files array.
      const handlePickedFiles = async (fileList) => {
        const files = Array.from(fileList || []).filter((f) => !/\.zip$/i.test(f.name || ''));
        if (files.length === 0) {
          setError('没有选中可上传的文件，请选择包含 SKILL.md 的文件夹');
          return;
        }
        setBusy('drop');
        setError('');
        setNotice('');
        try {
          const entries = [];
          for (const f of files) {
            entries.push({ path: f.webkitRelativePath || f.name, content: await f.text() });
          }
          const zip = Array.from(fileList || []).find((f) => /\.zip$/i.test(f.name || ''));
          if (zip) {
            const bytes = new Uint8Array(await zip.arrayBuffer());
            let bin = '';
            for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
            const r = await post('/api/skill-mcp-manager/import-zip', { zipBase64: btoa(bin), name: zip.name.replace(/\.zip$/i, '') }, AbortSignal.timeout(180000));
            if (!r.ok) throw new Error(r.error || '导入失败');
            setNotice(`已从 ${zip.name} 安装技能 ${r.slug}`);
          } else {
            const r = await call('skills.upload', { files: entries, force: true });
            const n = (r.items && r.items.length) || r.count || 0;
            setNotice(n > 0 ? `已上传 ${n} 个技能` : '没有找到可安装的技能（目录里需要有 SKILL.md）');
          }
          await loadInstalled();
        } catch (e) {
          setError(`上传失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const configureMcp = async () => {
        const f = mcpForm;
        if (!f.serverName.trim()) { setError('请填写 MCP 名称'); return; }
        if (f.transport === 'stdio' && !f.command.trim()) { setError('stdio 模式需要填写启动命令'); return; }
        if (f.transport === 'streamable-http' && !f.url.trim()) { setError('HTTP 模式需要填写 URL'); return; }
        let env;
        if (f.env.trim()) {
          try {
            env = JSON.parse(f.env.startsWith('{') ? f.env : `{${f.env}}`);
          } catch {
            setError('环境变量不是合法 JSON，例如 {"KEY":"value"}');
            return;
          }
        }
        setBusy('mcp-config');
        setError('');
        setNotice('');
        try {
          const payload = {
            serverName: f.serverName.trim(),
            transport: f.transport,
            env,
          };
          if (f.transport === 'stdio') {
            payload.command = f.command.trim();
            payload.args = f.args.trim() ? f.args.trim().split(/\s+/) : [];
          } else {
            payload.url = f.url.trim();
          }
          const result = await call('mcp.install', payload);
          const r = (result.results && result.results[0]) || {};
          if (r.missing && r.missing.length) {
            setError(`需要环境变量: ${r.missing.join(', ')}`);
          } else if (r.ok) {
            setNotice(`MCP ${payload.serverName} 已配置，工具数 ${r.toolCount || 0}`);
            setMcpForm({ serverName: '', transport: 'stdio', command: '', args: '', url: '', env: '' });
            setShowMcpForm(false);
          } else {
            setError(`配置失败: ${r.error || '未知错误'}`);
          }
          await loadInstalled();
        } catch (e) {
          setError(`配置失败: ${e.message || e}`);
        } finally {
          setBusy('');
        }
      };

      const installedSkillSet = useMemo(() => new Set(installed.map(s => s.slug)), [installed]);
      const installedMcpSet = useMemo(() => new Set(mounted.map(m => m.serverName)), [mounted]);

      const openPreview = useCallback((item) => {
        setPreviewView({ item, loading: true, error: null, data: null, installed: installedSkillSet.has(item.slug) });
        post('/api/skill-mcp-manager/skill-preview', item.path ? { path: item.path } : { item }, AbortSignal.timeout(60000))
          .then((r) => {
            if (r.ok) {
              setPreviewView((prev) => prev && prev.item === item ? { ...prev, loading: false, data: r } : prev);
            } else {
              setPreviewView((prev) => prev && prev.item === item ? { ...prev, loading: false, error: r.error || '预览失败' } : prev);
            }
          })
          .catch((e) => {
            setPreviewView((prev) => prev && prev.item === item ? { ...prev, loading: false, error: String(e.message || e) } : prev);
          });
      }, [installedSkillSet]);

      const displayItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const match = (item) => !q || `${item.name || ''} ${item.slug || ''} ${item.serverName || ''} ${item.description || ''}`.toLowerCase().includes(q);
        let items;

        if (isMySkills) {
          // skills.list has no enabled flag: disabled slugs come from settings.disabledSkills.
          const disabled = new Set(disabledSkills);
          items = installed.map(s => ({ ...s, type: 'skill', installed: true, key: s.slug, enabled: !disabled.has(String(s.slug).toLowerCase()), source: s.source || '本地' }));
        } else if (isMyMcp) {
          items = mounted.map(m => ({ ...m, type: 'mcp', installed: true, key: m.serverName, name: m.title || m.serverName, enabled: m.enabled !== false }));
        } else if (customItems) {
          items = customItems;
        } else {
          items = isSkillMarket ? skills : mcps;
        }

        items = items.filter(match);
        if (category !== 'all') items = items.filter(item => String(item.category || '').trim() === category);

        return items;
      }, [tab, isMySkills, isMyMcp, isSkillMarket, isMarket, skills, mcps, installed, mounted, customItems, searchQuery, category, disabledSkills, installedSkillSet, installedMcpSet]);

      // skills.search has no top-level categories; build them from the loaded items instead.
      const categoryList = useMemo(() => {
        const base = isMySkills ? installed : isMyMcp ? mounted : (customItems || (isSkillMarket ? skills : mcps));
        const counts = new Map();
        for (const item of base || []) {
          const name = String(item.category || '').trim();
          if (!name) continue;
          counts.set(name, (counts.get(name) || 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
      }, [tab, isMySkills, isMyMcp, isSkillMarket, installed, mounted, customItems, skills, mcps]);

      const showSidebar = isMarket && !customItems && categoryList.length >= 2;

      return h('div', { style: S.container },
        h('div', { style: S.header },
          h('button', { style: S.tab(isMySkills), onClick: () => setTab('my-skills') }, `我的技能 (${installed.length})`),
          h('button', { style: S.tab(isMyMcp), onClick: () => setTab('my-mcp') }, `我的 MCP (${mounted.length})`),
          h('button', { style: S.tab(isSkillMarket), onClick: () => setTab('skill-market') }, '技能市场'),
          h('button', { style: S.tab(isMcpMarket), onClick: () => setTab('mcp-market') }, 'MCP 市场')
        ),

        h('div', { style: S.mainContent },
          showSidebar && h('div', { style: S.sidebar },
            h('div', { style: S.sidebarTitle }, '分类'),
            h('div', {
              style: S.categoryItem(category === 'all'),
              onClick: () => handleCategoryChange('all')
            }, '全部'),
            categoryList.map(([cat, count]) =>
              h('div', {
                key: cat,
                style: S.categoryItem(category === cat),
                onClick: () => handleCategoryChange(cat)
              }, cat, h('span', { style: S.categoryCount }, String(count)))
            )
          ),

          h('div', { style: S.rightPanel },
            h('div', { style: S.toolbar },
              h('div', { style: S.searchBox },
                h('div', { style: S.searchIcon }, h(SearchIcon)),
                h('input', {
                  type: 'text',
                  placeholder: isMySkills ? '搜索我的技能...' : isMyMcp ? '搜索我的 MCP...' : (isSkillMarket ? '搜索技能...' : '搜索 MCP...'),
                  value: searchQuery,
                  onChange: (e) => setSearchQuery(e.target.value),
                  style: S.searchInput,
                })
              ),
              isSkillMarket && h('div', { style: S.filterChips },
                [['skillhub', 'SkillHub'], ['browse.sh', 'browse.sh'], ['clawhub', 'ClawHub'], ['skills.sh', 'skills.sh']].map(([src, label]) =>
                  h('button', {
                    key: src,
                    style: S.chip(source === src && !customItems),
                    onClick: () => { setCustomSkillMarket(''); setCustomItems(null); setSource(src) }
                  }, label)
                )
              ),
              isMcpMarket && h('div', { style: S.filterChips },
                ['registry', 'lobehub'].map(src =>
                  h('button', {
                    key: src,
                    style: S.chip(mcpSource === src && !customItems),
                    onClick: () => { setCustomMcpMarket(''); setCustomItems(null); setMcpSource(src) }
                  }, src === 'registry' ? 'MCP 官方' : 'LobeHub')
                )
              )
            ),

            isMarket && h('div', { style: S.toolbar },
              h('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)', flexShrink: 0 } }, '自定义市场'),
              h('div', { style: { flex: '1 1 320px', minWidth: '200px', position: 'relative' } },
                h('input', {
                  type: 'text',
                  placeholder: isSkillMarket ? '技能市场 JSON 索引地址，留空用内置来源' : 'MCP 市场 JSON 索引地址，留空用官方注册表',
                  value: isSkillMarket ? customSkillMarket : customMcpMarket,
                  onChange: (e) => (isSkillMarket ? setCustomSkillMarket(e.target.value) : setCustomMcpMarket(e.target.value)),
                  style: S.searchInput,
                })
              ),
              (isSkillMarket ? customSkillMarket : customMcpMarket) && h('button', {
                style: S.btn('default', false),
                onClick: () => (isSkillMarket ? setCustomSkillMarket('') : setCustomMcpMarket('')),
              }, '清除')
            ),

            isMySkills && h('div', { style: S.toolbar },
              h('input', {
                type: 'file',
                multiple: true,
                ref: dirInputRef,
                onChange: (e) => { handlePickedFiles(e.target.files); e.target.value = '' },
                style: { display: 'none' },
              }),
              h('div', {
                onClick: () => { if (busy !== 'drop' && dirInputRef.current) dirInputRef.current.click() },
                onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dropActive) setDropActive(true) },
                onDragEnter: (e) => { e.preventDefault(); setDropActive(true) },
                onDragLeave: (e) => { e.preventDefault(); setDropActive(false) },
                onDrop: (e) => { e.preventDefault(); e.stopPropagation(); setDropActive(false); handleDrop(e.dataTransfer) },
                role: 'button',
                tabIndex: 0,
                onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (dirInputRef.current) dirInputRef.current.click() } },
                style: {
                  flex: '1 1 100%', padding: '22px 18px', borderRadius: '12px',
                  border: `2px dashed ${dropActive ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
                  background: dropActive ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                  textAlign: 'center', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)',
                  cursor: busy === 'drop' ? 'progress' : 'pointer', transition: 'all 0.15s',
                },
              },
                h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: '4px' } },
                  busy === 'drop' ? '正在导入...' : (dropActive ? '松开即可导入' : '拖入技能文件夹或 .zip 压缩包，或点击选择')),
                h('div', null, '文件夹整包上传；压缩包自动解包安装；点击则打开本地文件夹选择器')
              )
            ),

            isMyMcp && h('div', { style: S.toolbar },
              h('button', { style: S.btn(showMcpForm ? 'default' : 'primary', false), onClick: () => setShowMcpForm(!showMcpForm) }, showMcpForm ? '收起配置' : '手动配置 MCP'),
              h('button', { style: S.btn(showJsonForm ? 'default' : 'primary', false), onClick: () => { setShowJsonForm(!showJsonForm); setShowMcpForm(false) } }, showJsonForm ? '收起 JSON' : '粘贴 MCP JSON'),
              h('button', {
                style: S.btn('default', false),
                onClick: () => openConfigFile((mounted[0] && mounted[0].path) || (mcps[0] && mcps[0].path)),
              }, '编辑配置文件'),
              h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '支持粘贴 mcpServers JSON、编辑已装 MCP 或直接改 mcp.json')
            ),

            isMyMcp && showJsonForm && h('div', { style: { padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' } },
              h('textarea', {
                style: S.jsonArea,
                placeholder: '{\n  "mcpServers": {\n    "my-mcp": { "command": "npx", "args": ["-y", "@scope/pkg"] }\n  }\n}',
                value: jsonText,
                onChange: (e) => setJsonText(e.target.value),
                spellCheck: false,
              }),
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                h('button', { style: S.btn('primary', busy === 'json-import'), disabled: busy === 'json-import', onClick: importMcpJson }, busy === 'json-import' ? '导入中...' : (jsonEditName ? '保存修改' : '导入 JSON')),
                jsonEditName && h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, `正在编辑：${jsonEditName}`),
                jsonEditName && h('button', { style: S.btn('default', false), onClick: () => { setJsonEditName(''); setJsonText('') } }, '取消编辑')
              )
            ),

            isMyMcp && showMcpForm && h('div', { style: { padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' } },
              h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
                h('input', { style: { ...S.searchInput, flex: '1 1 180px' }, placeholder: '名称，如 my-mcp', value: mcpForm.serverName, onChange: (e) => setMcpForm({ ...mcpForm, serverName: e.target.value }) }),
                h('select', { style: { ...S.searchInput, flex: '0 0 160px' }, value: mcpForm.transport, onChange: (e) => setMcpForm({ ...mcpForm, transport: e.target.value }) },
                  h('option', { value: 'stdio' }, 'stdio 命令'),
                  h('option', { value: 'streamable-http' }, 'HTTP 地址')
                )
              ),
              mcpForm.transport === 'stdio'
                ? h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
                    h('input', { style: { ...S.searchInput, flex: '1 1 180px' }, placeholder: '命令，如 npx 或 uvx', value: mcpForm.command, onChange: (e) => setMcpForm({ ...mcpForm, command: e.target.value }) }),
                    h('input', { style: { ...S.searchInput, flex: '1 1 220px' }, placeholder: '参数，空格分隔，如 -y @scope/pkg', value: mcpForm.args, onChange: (e) => setMcpForm({ ...mcpForm, args: e.target.value }) })
                  )
                : h('input', { style: S.searchInput, placeholder: 'MCP 服务 URL，如 https://example.com/mcp', value: mcpForm.url, onChange: (e) => setMcpForm({ ...mcpForm, url: e.target.value }) }),
              h('input', { style: S.searchInput, placeholder: '环境变量 JSON（可选），如 {"API_KEY":"xxx"}', value: mcpForm.env, onChange: (e) => setMcpForm({ ...mcpForm, env: e.target.value }) }),
              h('div', null,
                h('button', { style: S.btn('primary', busy === 'mcp-config'), disabled: busy === 'mcp-config', onClick: configureMcp }, busy === 'mcp-config' ? '配置中...' : '保存并连接')
              )
            ),

            h('div', { style: S.statsBar },
              customItems && h('span', null, '自定义市场'),
              isMySkills && h('span', null, '拖入或上传技能文件夹，点击卡片可打开所在目录'),
              isMyMcp && h('span', null, '粘贴 mcpServers JSON 即可批量导入，点击卡片可打开定义目录'),
              isMarket && h('span', null, h('span', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, '绿色标记'), ' 为已安装')
            ),

            error && h('div', { style: S.notice('error') }, 
              error,
              h('button', { style: S.closeBtn, onClick: () => setError('') }, h(XIcon, { size: 14 }))
            ),
            notice && h('div', { style: S.notice('info') }, 
              notice,
              h('button', { style: S.closeBtn, onClick: () => setNotice('') }, h(XIcon, { size: 14 }))
            ),

            h('div', { style: S.content },
              loading && page === 1 ? h('div', { style: S.loading }, '加载中...') :
              displayItems.length === 0 ? h('div', { style: S.empty },
                h('span', null, isMySkills ? '还没有安装任何技能，可以在上方上传，或到技能市场安装' :
                             isMyMcp ? '还没有配置任何 MCP，可以手动配置，或到 MCP 市场安装' :
                             '没有找到匹配的项目')
              ) :
              h('div', { style: S.list },
                displayItems.map((item, i) => {
                  const isSkill = isMySkills || isSkillMarket || item.type === 'skill';
                  const key = item.key || item.slug || item.serverName || item.id || i;
                  const isInstalled = isMySkills || isMyMcp || item.installed === true ||
                    (isSkill ? installedSkillSet.has(item.slug) : (installedMcpSet.has(item.serverName) || installedMcpSet.has(item.slug)));
                  const isBusy = busy.includes(key);
                  const isLast = i === displayItems.length - 1;
                  const enabled = item.enabled !== false && item.mounted !== false;
                  const serverKey = item.serverName || item.slug;
                  const serverStats = isMyMcp ? toolInfo.servers[serverKey] : null;
                  const serverTools = isMyMcp ? toolInfo.tools.filter(t => t.server === serverKey) : [];
                  const isExpanded = expandedServers.has(serverKey);
                  const fmtTokens = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
                  
                  return h('div', { 
                    key: i,
                    ref: isLast ? lastElementRef : null,
                    style: { ...S.listItem, opacity: isBusy ? 0.6 : 1, cursor: (!isMySkills && !isMyMcp && isSkill) ? 'pointer' : 'default' },
                    onClick: () => {
                      if (isMySkills) openDir(item, 'skill');
                      else if (isMyMcp) openDir(item, 'mcp');
                      else if (isSkill) openPreview(item); // 未安装的技能也能点开详情
                    },
                    onMouseEnter: (e) => { 
                      e.currentTarget.style.transform = 'translateY(-2px)'; 
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)';
                      e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary)';
                    },
                    onMouseLeave: (e) => { 
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l1)';
                    },
                  },
                    h('div', { style: S.itemHeader },
                      h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0, flex: 1 } },
                        h('div', { style: { ...S.statusDot(isInstalled, enabled), marginTop: '6px' } }),
                        h('span', { style: S.itemName }, item.name || item.slug || item.serverName || '未命名')
                      ),
                      isInstalled && h('span', { style: S.installedBadge }, 
                        h(CheckIcon, { size: 10 }),
                        '已装'
                      )
                    ),
                    h('div', { style: S.itemDesc }, item.description || '暂无描述'),
                    h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' } },
                      h('span', { style: S.usageTag },
                        '调用 ',
                        String(isSkill
                          ? (usage.skills && usage.skills[item.slug]) || 0
                          : (usage.mcp && usage.mcp[item.serverName || item.slug] && usage.mcp[item.serverName || item.slug].total) || 0),
                        ' 次'
                      ),
                      item.category && h('span', { style: S.usageTag }, item.category),
                      item.source && h('span', { style: S.usageTag }, item.sourceLabel || item.source)
                    ),
                    h('div', { style: S.itemActions },
                      (isMySkills || isMyMcp) && h('button', {
                        style: { ...S.btn('default', isBusy), flex: 1 },
                        disabled: isBusy,
                        onClick: (e) => {
                          e.stopPropagation();
                          if (isSkill) toggleSkill(item.slug, !enabled);
                          else toggleMcp(item.serverName || item.slug, !enabled);
                        }
                      }, isBusy ? '处理中...' : (enabled ? '禁用' : '启用')),
                      (isMySkills || isMyMcp) && h('button', {
                        style: { ...S.btn('default', false), flex: 1 },
                        onClick: (e) => {
                          e.stopPropagation();
                          openDir(item, isSkill ? 'skill' : 'mcp');
                        }
                      }, '打开目录'),
                      isMyMcp && h('button', {
                        style: { ...S.btn('default', false), flex: 1 },
                        onClick: (e) => {
                          e.stopPropagation();
                          editMcpJson(item);
                        }
                      }, '编辑 JSON'),
                      isInstalled ? 
                        h('button', {
                          style: { ...S.btn('danger', isBusy), flex: 1 },
                          disabled: isBusy,
                          onClick: (e) => {
                            e.stopPropagation();
                            if (isSkill) uninstallSkill(item.slug);
                            else uninstallMcp(item.serverName || item.slug);
                          }
                        }, isBusy ? '处理中...' : '卸载') :
                        h('button', {
                          style: { ...S.btn('primary', isBusy), flex: 1 },
                          disabled: isBusy,
                          onClick: (e) => {
                            e.stopPropagation();
                            isSkill ? installSkill(item) : installMcp(item);
                          }
                        }, isBusy ? '安装中...' : '安装'),
                      isSkill && h('button', {
                        style: { ...S.btn('default', false), padding: '6px 12px' },
                        onClick: (e) => {
                          e.stopPropagation();
                          openPreview(item);
                        }
                      }, '预览')
                    ),
                    serverStats && serverStats.count > 0 && h('div', null,
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' } },
                        h('button', {
                          style: { ...S.btn('default', false), padding: '4px 10px', fontSize: '12px', flex: 'none' },
                          onClick: (e) => {
                            e.stopPropagation();
                            setExpandedServers(prev => {
                              const next = new Set(prev);
                              if (next.has(serverKey)) next.delete(serverKey); else next.add(serverKey);
                              return next;
                            });
                          },
                        }, isExpanded ? '收起工具' : `查看工具（${serverStats.count}）`),
                        h('span', { style: S.usageTag },
                          `${serverStats.count} 个工具 · 约 ${fmtTokens(serverStats.tokens)} 上下文`),
                        serverStats.disabled > 0 && h('span', { style: S.usageTag }, `已禁用 ${serverStats.disabled}`)
                      ),
                      isExpanded && h('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' } },
                        serverTools.map(tool =>
                          h('div', { key: tool.name, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', borderRadius: '8px', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)' } },
                            h('div', { style: { flex: 1, minWidth: 0 } },
                              h('div', { style: { fontSize: '12.5px', fontWeight: 600, color: tool.disabled ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-label-primary)', fontFamily: 'ui-monospace, Consolas, monospace' } }, tool.label),
                              h('div', { style: { fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tool.description || '无描述'),
                              h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, `约 ${fmtTokens(tool.tokens)} 上下文`)
                            ),
                            h('button', {
                              style: { ...S.btn(tool.disabled ? 'primary' : 'default', false), flex: 'none', padding: '4px 10px', fontSize: '12px' },
                              disabled: busy === `tool:${tool.name}`,
                              onClick: (e) => { e.stopPropagation(); toggleTool(tool.name, tool.disabled) },
                            }, busy === `tool:${tool.name}` ? '...' : (tool.disabled ? '启用' : '禁用'))
                          )
                        )
                      )
                    )
                  );
                })
              ),
              loadingMore && h('div', { style: S.loadingMore }, '加载更多...')
            )
          )
        ),
        configEditor && h('div', { style: S.modalBackdrop, onClick: () => { if (!configEditor.busy) setConfigEditor(null) } },
          h('div', { style: S.modalContent, onClick: (e) => e.stopPropagation() },
            h('div', { style: S.modalHeader },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: S.modalTitle }, '编辑 MCP 配置文件'),
                h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, configEditor.path)
              ),
              h('button', { style: S.closeBtn, disabled: configEditor.busy, onClick: () => setConfigEditor(null) }, h(XIcon, { size: 16 }))
            ),
            h('div', { style: { flex: 1, overflow: 'auto', padding: '16px 20px' } },
              h('textarea', {
                style: { ...S.jsonArea, minHeight: '360px' },
                value: configEditor.text,
                spellCheck: false,
                onChange: (e) => setConfigEditor({ ...configEditor, text: e.target.value, error: '' }),
              }),
              configEditor.error && h('div', { style: { marginTop: '10px', color: 'var(--dsw-alias-state-error-primary)', fontSize: '13px' } }, configEditor.error)
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid var(--dsw-alias-border-l1)' } },
              h('button', { style: S.btn('default', configEditor.busy), disabled: configEditor.busy, onClick: () => setConfigEditor(null) }, '取消'),
              h('button', { style: S.btn('primary', configEditor.busy), disabled: configEditor.busy, onClick: saveConfigFile }, configEditor.busy ? '保存中...' : '保存')
            )
          )
        ),
        previewView && h(PreviewModal, {
          view: previewView,
          onClose: () => setPreviewView(null),
          onInstall: (item) => {
            installSkill(item);
            setPreviewView(null);
          },
          onUninstall: (slug) => {
            uninstallSkill(slug);
            setPreviewView(null);
          },
          busy,
        })
      );
    }

    function ManagerIcon(props) {
      const size = props.size || 20;
      return h(PackageIcon, { size });
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'skill-mcp-manager', order: 15, label: () => '技能 & MCP' },
            ManagerIcon
          )
        );
        
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'skill-mcp-manager' }, SkillMcpManager)
        );
      },
    };
  },
});

