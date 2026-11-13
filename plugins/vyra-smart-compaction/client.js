/**
 * smart-compaction — web half.
 *
 * One ambient chip below the composer that appears only once context pressure
 * leaves the calm band, so the user sees the same ladder the model sees
 * (`context_report`) without asking for it. Clicking it opens the report's
 * recommendation. It reads the host's pressure endpoint and owns no state of
 * its own beyond the last poll.
 *
 * @module vyra-smart-compaction/client
 */

window.__ModuleLoader__.load({
  id: 'vyra-smart-compaction',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** How often the chip refreshes; the ladder moves at turn granularity. */
    const REFRESH_MS = 5000
    /** The host route this chip reads. */
    const ENDPOINT = '/api/smart-compaction/pressure'

    /**
     * Poll the pressure endpoint for one session.
     * @param sessionId - the session the chip is rendering for.
     * @returns the last successful payload, or undefined.
     */
    function usePressure(sessionId) {
      const [report, setReport] = React.useState(undefined)
      React.useEffect(() => {
        if (sessionId === undefined || sessionId === null) return undefined
        let cancelled = false
        const refresh = () => {
          void globalThis
            .fetch(`${ENDPOINT}?session=${encodeURIComponent(String(sessionId))}`, { credentials: 'include' })
            .then((response) => (response.ok ? response.json() : undefined))
            .then((next) => {
              if (!cancelled) setReport(next)
            })
            .catch(() => {
              /* an unreachable route leaves the chip hidden, never broken */
            })
        }
        refresh()
        const timer = setInterval(refresh, REFRESH_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [sessionId])
      return report
    }

    /** The accent color for one ladder rung, from the host's theme tokens. */
    function rungColor(rung) {
      if (rung === 'emergency') return 'var(--dsw-alias-state-error-primary)'
      if (rung === 'trigger') return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-label-secondary)'
    }

    /**
     * Ambient context-pressure chip: hidden while context is calm, expandable
     * into the ladder's own recommendation.
     */
    function PressureChip(props) {
      const report = usePressure(props?.sessionId)
      const [open, setOpen] = React.useState(false)

      if (report === undefined || report.ok !== true || report.rung === undefined || report.rung === 'calm') {
        return null
      }
      const color = rungColor(report.rung)
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8em', lineHeight: 1.4 } },
        h(
          'button',
          {
            type: 'button',
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'flex-start',
              padding: '2px 8px',
              background: 'transparent',
              border: `1px solid var(--dsw-alias-border-l1)`,
              borderRadius: '999px',
              color,
              cursor: 'pointer',
              font: 'inherit',
            },
          },
          h('span', { 'aria-hidden': true, style: { fontSize: '0.9em' } }, '◱'),
          `Context ${report.usedPercent} · ${report.rung}`,
        ),
        open
          ? h(
              'div',
              {
                style: {
                  maxWidth: '420px',
                  padding: '8px 10px',
                  color: 'var(--dsw-alias-label-secondary)',
                  background: 'var(--dsw-alias-bg-layer-1)',
                  border: '1px solid var(--dsw-alias-border-l1)',
                  borderRadius: '6px',
                },
              },
              report.recommendation,
              h(
                'div',
                { style: { marginTop: '4px', color: 'var(--dsw-alias-label-secondary)', opacity: 0.8 } },
                `${report.pressureTokens} / ${report.usableTokens} tokens of a ${report.contextWindow}-token window`,
              ),
              h(
                'div',
                { style: { marginTop: '4px', opacity: 0.8 } },
                'Run /smart-compact, or let the agent decide with compact_context.',
              ),
            )
          : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            { name: 'conversation.composer.dock', id: 'smart-compaction-pressure', order: 20 },
            PressureChip,
          ),
        )
      },
    }
  },
})
