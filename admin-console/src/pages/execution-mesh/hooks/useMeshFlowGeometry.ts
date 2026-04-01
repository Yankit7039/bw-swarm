import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export type MeshFlowAnchors = {
  hub: HTMLElement | null
  clusters: Partial<Record<string, HTMLElement | null>>
}

export type MeshQueueToHubPath = {
  orderId: string
  d: string
  /** Mesh focus / display order — opaque path and ingest motion when flow is active. */
  isActiveFocus: boolean
}

export type MeshFlowPaths = {
  width: number
  height: number
  queueToHubPaths: MeshQueueToHubPath[]
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

function pathsEqual(a: MeshQueueToHubPath[], b: MeshQueueToHubPath[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].orderId !== b[i].orderId ||
      a[i].d !== b[i].d ||
      a[i].isActiveFocus !== b[i].isActiveFocus
    ) {
      return false
    }
  }
  return true
}

export function useMeshFlowGeometry(
  meshRef: RefObject<HTMLElement | null>,
  anchorsRef: RefObject<MeshFlowAnchors>,
  options: {
    activeClusterId: string | null
    showHubToCluster: boolean
    /** Bump when any anchor element registers. */
    anchorRevision: number
    /** One queue→hub curve per id (pending orders are omitted). */
    queueConnectorOrderIds: string[]
    /** Which connector is the primary (opaque) path. */
    activeFocusOrderId: string | null
  },
) {
  const [paths, setPaths] = useState<MeshFlowPaths>({
    width: 0,
    height: 0,
    queueToHubPaths: [],
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

      const queueToHubPaths: MeshQueueToHubPath[] = []
      if (a.hub && w > 0 && h > 0) {
        const focus = options.activeFocusOrderId
        for (const orderId of options.queueConnectorOrderIds) {
          const card = root.querySelector<HTMLElement>(
            `[data-mesh-queue-order="${CSS.escape(orderId)}"]`,
          )
          if (!card) continue
          const p0 = pointRightCenter(card, cr)
          const p1 = pointLeftCenter(a.hub, cr)
          queueToHubPaths.push({
            orderId,
            d: cubicBezierH(p0.x, p0.y, p1.x, p1.y),
            isActiveFocus: focus != null && focus !== '' && orderId === focus,
          })
        }
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
          pathsEqual(prev.queueToHubPaths, queueToHubPaths) &&
          prev.hubToCluster?.d === hubToCluster?.d &&
          prev.hubToCluster?.clusterId === hubToCluster?.clusterId
        ) {
          return prev
        }
        return { width: w, height: h, queueToHubPaths, hubToCluster }
      })
    })
  }, [
    meshRef,
    anchorsRef,
    options.showHubToCluster,
    options.activeClusterId,
    options.queueConnectorOrderIds,
    options.activeFocusOrderId,
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
      if (a.hub) ro.observe(a.hub)
      for (const el of Object.values(a.clusters)) {
        if (el) ro.observe(el)
      }
      for (const orderId of options.queueConnectorOrderIds) {
        const card = root.querySelector<HTMLElement>(
          `[data-mesh-queue-order="${CSS.escape(orderId)}"]`,
        )
        if (card) ro.observe(card)
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
  }, [meshRef, measure, options.anchorRevision, options.queueConnectorOrderIds])

  return { paths, remeasure: measure }
}
