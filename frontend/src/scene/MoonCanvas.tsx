// LUNAR modification (2026-11-15): branding, workspace integration, settings isolation, display shadows or WebGL fallback. Original Apache-2.0 source: daniel27-space/lunar-navigator; see NOTICE.
// LUNAR adaptation: preserve science UI when WebGL2 is unavailable.
// The main 3D canvas. It is its own small component so that the switch between sharp frames (at
// rest) and cheaper frames (while the view is moving or the clock is running) redraws only this,
// not the whole app: redrawing the app at the start of every drag caused a visible hitch.
import { useEffect, useState, type ReactNode } from 'react'
import { Canvas, useStore as useStore3 } from '@react-three/fiber'
import { DETAIL, useStore, type Quality } from '../store'
import { POLE_POSE } from './Rig'

/** The most device pixels per CSS pixel drawn while the view is moving. */
const MOVING_DPR = 1

/** True while frames should be drawn more cheaply: the view is moving, or the clock is running. */
export const useBusy = () => useStore((s) => s.moving || s.playing)

/**
 * Draws the view at once whenever the canvas changes size or resolution. A resize empties the
 * canvas, and the next drawn frame only comes a moment later, so the browser could show the
 * empty canvas in between: a black flash. Drawing in the same step as the resize leaves nothing
 * empty to show. A few more frames follow, so every buffer the browser keeps holds a picture.
 */
function Settle() {
  const store = useStore3()
  useEffect(() => {
    let frame = 0
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.size === prev.size && state.viewport.dpr === prev.viewport.dpr) return
      state.gl.render(state.scene, state.camera)
      let left = SETTLE_FRAMES
      cancelAnimationFrame(frame)
      const again = () => {
        state.invalidate()
        if (--left > 0) frame = requestAnimationFrame(again)
      }
      frame = requestAnimationFrame(again)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [store])
  return null
}
const SETTLE_FRAMES = 3

export function MoonCanvas({ quality, children }: { quality: Quality; children: ReactNode }) {
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      if (!gl) return false
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return true
    } catch { return false }
  })
  const busy = useBusy()
  const full = DETAIL[quality].dpr
  if (!supported) return <div className="lunar-gl-fallback" role="status"><h2>3D needs WebGL 2</h2><p>Enable browser graphics acceleration and reload. Studies, guides and scientific results remain available.</p></div>
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: POLE_POSE.pos, up: POLE_POSE.up, near: 1, far: 30000, fov: 40 }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      dpr={[1, busy ? Math.min(full, MOVING_DPR) : full]}
    >
      <Settle />
      {children}
    </Canvas>
  )
}
