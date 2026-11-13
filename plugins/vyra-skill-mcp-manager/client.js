// Client half: browser UI for skill & MCP management
window.__ModuleLoader__.load({
  id: 'vyra-skill-mcp-manager',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    const RPC = '/api/dsh-market/rpc';

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
            h('div', null, renderMarkdown(parsed ? parsed.body : ''))
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
      
      const [source, setSource] = useState('skills.sh');
      const [mcpSource, setMcpSource] = useState('registry');
      
      const [category, setCategory] = useState('all');
      const [categories, setCategories] = useState([]);
      
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);
      const [loadingMore, setLoadingMore] = useState(false);
      
      const [busy, setBusy] = useState('');
      const abortControllerRef = useRef(null);
      
      const [previewView, setPreviewView] = useState(null);

      // upload / manual config / custom market
      const [uploadPath, setUploadPath] = useState('');
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

      const isMySkills = tab === 'my-skills';
      const isMyMcp = tab === 'my-mcp';
      const isSkillMarket = tab === 'skill-market';
      const isMcpMarket = tab === 'mcp-market';
      const isMarket = isSkillMarket || isMcpMarket;

      const loadInstalled = useCallback(async () => {
        try {
          const [s, m] = await Promise.all([call('skills.list'), call('mcp.list')]);
          setInstalled((s && s.items) || []);
          setMounted((m && m.items) || []);
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
          
          if (result && result.categories && result.categories.length > 0) {
            setCategories(result.categories);
          }
          
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
          
          if (result && result.categories && result.categories.length > 0) {
            setCategories(result.categories);
          }
          
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
        if (isSkillMarket) {
          setCategory('all');
          setCategories([]);
          setPage(1);
          setHasMore(true);
          if (!customSkillMarket) searchSkills(debouncedQuery);
        } else if (isMcpMarket) {
          setCategory('all');
          setCategories([]);
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
        setCategory(cat);
        setPage(1);
        setHasMore(true);
        if (isSkillMarket && !customItems) {
          searchSkills(debouncedQuery, { category: cat, page: 1, source });
        } else if (isMcpMarket && !customItems) {
          searchMcps(debouncedQuery, { category: cat, page: 1, source: mcpSource });
        }
      }, [tab, isSkillMarket, isMcpMarket, customItems, debouncedQuery, source, mcpSource, searchSkills, searchMcps]);

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

      const uploadSkills = async () => {
        const path = uploadPath.trim();
        if (!path) {
          setError('请填写技能文件夹路径');
          return;
        }
        setBusy('upload');
        setError('');
        setNotice('');
        try {
          const r = await call('skills.upload', { path, force: true });
          const count = (r.items && r.items.length) || 0;
          setNotice(count > 0 ? `已上传 ${count} 个技能` : '没有找到可上传的技能（目录里需要 SKILL.md）');
          setUploadPath('');
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
          // skills.list has no enabled flag; disabled skills are tracked by the market plugin,
          // so treat everything listed as installed and enabled.
          items = installed.map(s => ({ ...s, type: 'skill', installed: true, key: s.slug, enabled: s.enabled !== false, source: s.source || '本地' }));
        } else if (isMyMcp) {
          items = mounted.map(m => ({ ...m, type: 'mcp', installed: true, key: m.serverName, name: m.title || m.serverName, enabled: m.enabled !== false }));
        } else if (customItems) {
          items = customItems;
        } else {
          items = isSkillMarket ? skills : mcps;
        }

        items = items.filter(match);

        return items;
      }, [tab, isMySkills, isMyMcp, isSkillMarket, isMarket, skills, mcps, installed, mounted, customItems, searchQuery, installedSkillSet, installedMcpSet]);

      const showSidebar = isMarket && !customItems && categories.length > 0;

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
            categories.slice(0, 20).map(cat => 
              h('div', {
                key: cat,
                style: S.categoryItem(category === cat),
                onClick: () => handleCategoryChange(cat)
              }, cat)
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
                ['skills.sh', 'skillhub', 'browse.sh'].map(src =>
                  h('button', {
                    key: src,
                    style: S.chip(source === src && !customItems),
                    onClick: () => { setCustomSkillMarket(''); setCustomItems(null); setSource(src) }
                  }, src)
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
              h('div', {
                onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
                onDrop: (e) => { e.preventDefault(); handleDrop(e.dataTransfer) },
                onClick: () => {},
                style: {
                  flex: '1 1 340px', minWidth: '240px', padding: '18px', borderRadius: '12px',
                  border: `2px dashed ${dropActive ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
                  background: dropActive ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                  textAlign: 'center', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s',
                },
                onDragEnter: () => setDropActive(true),
                onDragLeave: () => setDropActive(false),
              },
                h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: '4px' } }, busy === 'drop' ? '正在导入...' : '拖入技能文件夹或 .zip 压缩包'),
                h('div', null, '文件夹会整包上传；压缩包会自动解包安装')
              ),
              h('div', { style: { display: 'flex', gap: '8px', flex: '1 1 280px', minWidth: '200px' } },
                h('input', {
                  type: 'text',
                  placeholder: '或填本地文件夹路径',
                  value: uploadPath,
                  onChange: (e) => setUploadPath(e.target.value),
                  onKeyDown: (e) => { if (e.key === 'Enter') uploadSkills() },
                  style: S.searchInput,
                }),
                h('button', { style: S.btn('primary', busy === 'upload'), disabled: busy === 'upload', onClick: uploadSkills }, busy === 'upload' ? '上传中...' : '上传')
              )
            ),

            isMyMcp && h('div', { style: S.toolbar },
              h('button', { style: S.btn(showMcpForm ? 'default' : 'primary', false), onClick: () => setShowMcpForm(!showMcpForm) }, showMcpForm ? '收起配置' : '手动配置 MCP'),
              h('button', { style: S.btn(showJsonForm ? 'default' : 'primary', false), onClick: () => { setShowJsonForm(!showJsonForm); setShowMcpForm(false) } }, showJsonForm ? '收起 JSON' : '粘贴 MCP JSON'),
              h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, '支持直接粘贴 mcpServers JSON，或编辑已装 MCP')
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
                  
                  return h('div', { 
                    key: i,
                    ref: isLast ? lastElementRef : null,
                    style: { ...S.listItem, opacity: isBusy ? 0.6 : 1, cursor: isMarket ? 'default' : 'pointer' },
                    onClick: () => { if (isMySkills) openDir(item, 'skill'); else if (isMyMcp) openDir(item, 'mcp') },
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
                    )
                  );
                })
              ),
              loadingMore && h('div', { style: S.loadingMore }, '加载更多...')
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
