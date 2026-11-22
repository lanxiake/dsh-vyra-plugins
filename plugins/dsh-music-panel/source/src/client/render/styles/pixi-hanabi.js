/**
 * 花火 — a pixi style: the sung line in the middle, fireworks bursting around it.
 *
 * It is the pixi counterpart of the canvas styles: same registry, same stage
 * contract, but the scene graph is pixi's. If pixi failed to load, `LyricStage`
 * opens `classic` instead, so this entry is never reached with `MP_PIXI === null`.
 */

mpRegisterStyle({
  id: 'hanabi',
  labelKey: 'sheet.styleHanabi',
  glyph: 'star',
  kind: 'pixi',
  create: function (app, size) {
    var root = new MP_PIXI.Container()
    app.stage.addChild(root)

    var sparks = new MP_PIXI.Graphics()
    root.addChild(sparks)

    var text = new MP_PIXI.Text({
      text: '',
      style: {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: Math.max(18, Math.min(46, (size.width || 800) / 22)),
        fontWeight: '600',
        fill: 0xffffff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: Math.max(200, (size.width || 800) * 0.72),
      },
    })
    text.anchor.set(0.5)
    root.addChild(text)

    var particles = []
    var lastActive = -2
    var lastBurst = 0

    function burst(x, y, accent, time) {
      for (var index = 0; index < 26; index += 1) {
        var angle = (Math.PI * 2 * index) / 26 + (index % 3) * 0.12
        var speed = 40 + ((index * 37) % 90)
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          hue: accent,
          size: 1.6 + (index % 4) * 0.7,
        })
      }
    }

    return {
      draw: function (state) {
        var width = state.width || size.width
        var height = state.height || size.height
        var lines = Array.isArray(state.lines) ? state.lines : []
        var active = Number(state.active)
        var line = active >= 0 && active < lines.length ? lines[active] : null
        text.text = line && typeof line.text === 'string' ? line.text : ''
        text.x = width / 2
        text.y = height / 2

        if (active !== lastActive) {
          lastActive = active
          if (line !== null && state.time - lastBurst > 0.2) {
            lastBurst = state.time
            burst(width * (0.18 + ((active * 41) % 64) / 100), height * (0.24 + ((active * 17) % 40) / 100), state.accent, state.time)
          }
        }

        sparks.clear()
        for (var index = particles.length - 1; index >= 0; index -= 1) {
          var part = particles[index]
          part.x += part.vx * 0.016
          part.y += part.vy * 0.016 + 26 * 0.016
          part.vy += 36 * 0.016
          part.life -= 0.012
          if (part.life <= 0) {
            particles.splice(index, 1)
            continue
          }
          sparks.circle(part.x, part.y, part.size * part.life)
          sparks.fill({ color: 0xffffff, alpha: 0.75 * part.life })
        }
      },
      destroy: function () {
        particles.length = 0
      },
    }
  },
})
