import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export type MeshFlowAnchors = {
  queue: HTMLElement | null
  hub: HTMLElement | null
  clusters: Partial<Record<string, HTMLElement | null>>
}

export type MeshFlowPaths = {
  width: number
  height: number
  queueToHub: string | null
  hubToCluster: { clusterId: string; d: string } | null
}

function pointRightCenter(el: HTMLElement, root: DOMRect) {
  const r = el.getBoundingClientRect()
  return { x: r.right - root.left, y: r.top + r.height / 2 - root.top }
}

function pointLeftCenter(el: HTMLElement, root: DOMRect) {
  const r = el.getBoundingClientRect()
  return { x: r.left - root.left, y: r.top + r.height / 2 - root.top }
}

/** Horizontal flow-friendly cubic curve. */
function cubicBezierH(x1: number, y1: number, x2: number, y2: number, tension = 0.4) {
  const dx = x2 - x1
  const cx1 = x1 + dx * tension
  const cx2 = x2 - dx * tension
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${y1.toFixed(1)} ${cx2.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

export function useMeshFlowGeometry(
  meshRef: RefObject<HTMLElement | null>,
  anchorsRef: RefObject<MeshFlowAnchors>,
  options: {
    activeClusterId: string | null
    showHubToCluster: boolean
    /** Bump when any anchor element registers. */
    anchorRevision: number
  },
) {
  const [paths, setPaths] = useState<MeshFlowPaths>({
    width: 0,
    height: 0,
    queueToHub: null,
    hubToCluster: null,
  })

  const rafRef = useRef<number | null>(null)

  const measure = useCallback(() => {
    const root = meshRef.current
    if (!root) return

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const cr = root.getBoundingClientRect()
      const w = cr.width
      const h = cr.height
      const a = anchorsRef.current
      if (!a) return

      let queueToHub: string | null = null
      if (a.queue && a.hub && w > 0 && h > 0) {
        const p0 = pointRightCenter(a.queue, cr)
        const p1 = pointLeftCenter(a.hub, cr)
        queueToHub = cubicBezierH(p0.x, p0.y, p1.x, p1.y)
      }

      let hubToCluster: { clusterId: string; d: string } | null = null
      if (
        options.showHubToCluster &&
        options.activeClusterId &&
        a.hub &&
        w > 0 &&
        h > 0
      ) {
        const clusterEl = a.clusters[options.activeClusterId]
        if (clusterEl) {
          const p0 = pointRightCenter(a.hub, cr)
          const p1 = pointLeftCenter(clusterEl, cr)
          hubToCluster = {
            clusterId: options.activeClusterId,
            d: cubicBezierH(p0.x, p0.y, p1.x, p1.y),
          }
        }
      }

      setPaths((prev) => {
        if (
          prev.width === w &&
          prev.height === h &&
          prev.queueToHub === queueToHub &&
          prev.hubToCluster?.d === hubToCluster?.d &&
          prev.hubToCluster?.clusterId === hubToCluster?.clusterId
        ) {
          return prev
        }
        return { width: w, height: h, queueToHub, hubToCluster }
      })
    })
  }, [
    meshRef,
    anchorsRef,
    options.showHubToCluster,
    options.activeClusterId,
  ])

  useLayoutEffect(() => {
    measure()
  }, [measure, options.anchorRevision])

  useEffect(() => {
    const root = meshRef.current
    if (!root) return

    const ro = new ResizeObserver(() => measure())
    ro.observe(root)

    const observeAnchors = () => {
      const a = anchorsRef.current
      if (!a) return
      if (a.queue) ro.observe(a.queue)
      if (a.hub) ro.observe(a.hub)
      for (const el of Object.values(a.clusters)) {
        if (el) ro.observe(el)
      }
    }
    observeAnchors()

    const onScroll = () => measure()
    root.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', measure)

    return () => {
      ro.disconnect()
      root.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', measure)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [meshRef, measure, options.anchorRevision])

  return { paths, remeasure: measure }
}
