#!/usr/bin/env python3
"""
Measure workflow start latency via runtime APIs.

Uses POST /runs, GET /runs/{id}, GET /runs/{id}/events to compute
time_to_start = first_event.created_at - run.created_at.

With concurrent requests exceeding warm pool size, later requests show cold-start latency.
Requires: httpx (pip install httpx)
"""

import argparse
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from statistics import median

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx", file=sys.stderr)
    sys.exit(1)


def _parse_iso(s: str) -> datetime:
    """Parse ISO8601 timestamp; normalize to UTC for difference calculation."""
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _post_run(base_url: str, template_id: str, payload: dict, timeout: float) -> dict | None:
    """POST /runs; return JSON or None on failure."""
    url = base_url.rstrip("/") + "/runs"
    try:
        r = httpx.post(url, json={"template_id": template_id, "payload": payload}, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def _post_run_at_barrier(
    barrier: threading.Barrier,
    base_url: str,
    template_id: str,
    payload: dict,
    timeout: float,
) -> tuple[dict | None, float, float]:
    """
    Wait on barrier so all threads release together, then POST /runs.
    Returns (response_json, t_start, t_end) with perf_counter times for simultaneity check.
    """
    barrier.wait()
    t_start = time.perf_counter()
    url = base_url.rstrip("/") + "/runs"
    try:
        r = httpx.post(url, json={"template_id": template_id, "payload": payload}, timeout=timeout)
        r.raise_for_status()
        out = r.json()
    except Exception:
        out = None
    t_end = time.perf_counter()
    return (out, t_start, t_end)


def _get_run(base_url: str, run_id: str, timeout: float) -> dict | None:
    """GET /runs/{run_id}; return JSON or None."""
    url = f"{base_url.rstrip('/')}/runs/{run_id}"
    try:
        r = httpx.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def _get_events(base_url: str, run_id: str, timeout: float) -> list | None:
    """GET /runs/{run_id}/events; return list or None."""
    url = f"{base_url.rstrip('/')}/runs/{run_id}/events"
    try:
        r = httpx.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def _measure_one(
    base_url: str,
    template_id: str,
    run_id: str,
    created_at_str: str | None,
    timeout: float,
    poll_interval: float,
) -> tuple[str, float | None, str, str | None]:
    """
    Poll until we have at least one event or run failed; compute time_to_start.
    Returns (run_id_short, time_to_start_sec or None, status, assigned_pod).
    """
    run_data = _get_run(base_url, run_id, timeout)
    if not run_data:
        return (run_id[:12], None, "error", None)
    status = run_data.get("status", "pending")
    created_at_str = created_at_str or run_data.get("created_at")
    assigned_pod = run_data.get("assigned_pod")

    # Poll until status is terminal or we have events
    deadline = time.monotonic() + timeout
    while status == "pending" and time.monotonic() < deadline:
        time.sleep(poll_interval)
        run_data = _get_run(base_url, run_id, timeout)
        if run_data:
            status = run_data.get("status", "pending")
            created_at_str = created_at_str or run_data.get("created_at")
            assigned_pod = run_data.get("assigned_pod")

    # Now poll events until at least one or failed
    while status not in ("failed", "completed") and time.monotonic() < deadline:
        events = _get_events(base_url, run_id, timeout)
        if events and len(events) >= 1:
            first = events[0]
            first_created = first.get("created_at")
            if created_at_str and first_created:
                try:
                    t0 = _parse_iso(created_at_str)
                    t1 = _parse_iso(first_created)
                    sec = (t1 - t0).total_seconds()
                    return (run_id[:12], sec, status, assigned_pod)
                except Exception:
                    pass
            return (run_id[:12], None, status, assigned_pod)
        if status == "failed":
            break
        time.sleep(poll_interval)
        run_data = _get_run(base_url, run_id, timeout)
        if run_data:
            status = run_data.get("status", status)

    # Timeout or failed before first event
    if status == "failed":
        return (run_id[:12], None, "failed", assigned_pod)
    return (run_id[:12], None, "timeout", assigned_pod)


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = max(0, int(len(s) * 0.95) - 1)
    return s[idx]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure workflow start latency (time to first event) via runtime APIs."
    )
    parser.add_argument(
        "--url",
        default="http://localhost:30080",
        help="Runtime base URL (8000 for docker-compose, 30080 for k8s NodePort)",
    )
    parser.add_argument(
        "--template",
        default="stuck-order-resolution",
        help="Template ID",
    )
    parser.add_argument(
        "--concurrent",
        type=int,
        default=5,
        help="Number of concurrent requests",
    )
    parser.add_argument(
        "--warm-pool-size",
        type=int,
        default=3,
        help="Warm pool size (for reporting warm vs cold)",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=0.5,
        help="Seconds between event polls",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="Max seconds to wait per run",
    )
    parser.add_argument(
        "--output",
        choices=("text", "json", "csv"),
        default="text",
        help="Output format",
    )
    parser.add_argument(
        "--simultaneous",
        action="store_true",
        help="Use a barrier so all POST /runs fire at the same instant (for race-condition checks). Reports request start spread in ms.",
    )
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    n = args.concurrent
    warm = args.warm_pool_size

    # 1. Fire N concurrent POST /runs (optionally barrier-synchronized for true simultaneity)
    results: list[tuple[str, str, float | None, str, str | None]] = []  # run_id, short_id, sec, status, pod
    request_start_spread_ms: float | None = None

    if args.simultaneous:
        barrier = threading.Barrier(n)
        payloads = [{"order_id": f"ORDER-{uuid.uuid4().hex[:8]}"} for _ in range(n)]
        run_ids = []
        start_times: list[float] = []
        with ThreadPoolExecutor(max_workers=n) as executor:
            futures = [
                executor.submit(
                    _post_run_at_barrier,
                    barrier,
                    base_url,
                    args.template,
                    pl,
                    30.0,
                )
                for pl in payloads
            ]
            for fut in futures:
                resp, t_start, t_end = fut.result()
                start_times.append(t_start)
                if resp and "run_id" in resp:
                    run_ids.append(resp["run_id"])
        if len(start_times) >= 2:
            request_start_spread_ms = (max(start_times) - min(start_times)) * 1000.0
    else:
        with ThreadPoolExecutor(max_workers=n) as executor:
            futures = []
            run_ids = []
            for _ in range(n):
                order_id = f"ORDER-{uuid.uuid4().hex[:8]}"
                payload = {"order_id": order_id}
                fut = executor.submit(_post_run, base_url, args.template, payload, 30.0)
                futures.append(fut)
            for fut in as_completed(futures):
                resp = fut.result()
                if not resp or "run_id" not in resp:
                    continue
                run_ids.append(resp["run_id"])

    # 2. For each run_id, measure (poll run + events, compute time_to_start)
    with ThreadPoolExecutor(max_workers=n) as executor:
        futs = {
            executor.submit(
                _measure_one,
                base_url,
                args.template,
                rid,
                None,
                args.timeout,
                args.poll_interval,
            ): rid
            for rid in run_ids
        }
        for fut in as_completed(futs):
            run_id = futs[fut]
            try:
                short_id, sec, status, pod = fut.result()
                results.append((run_id, short_id, sec, status, pod))
            except Exception:
                results.append((run_id, run_id[:12], None, "error", None))

    # 3. Sort by time_to_start (ascending); None last
    results.sort(key=lambda x: (x[2] is None, x[2] if x[2] is not None else float("inf")))

    # 4. Output
    valid_secs = [r[2] for r in results if r[2] is not None]
    if args.output == "json":
        import json
        out = [
            {
                "run_id": r[0],
                "run_id_short": r[1],
                "time_to_start_sec": r[2],
                "status": r[3],
                "assigned_pod": r[4],
            }
            for r in results
        ]
        summary = {}
        if valid_secs:
            summary = {
                "min_sec": min(valid_secs),
                "median_sec": median(valid_secs),
                "max_sec": max(valid_secs),
                "p95_sec": _p95(valid_secs),
                "warm_pool_size": warm,
                "concurrent": n,
            }
        if request_start_spread_ms is not None:
            summary["request_start_spread_ms"] = round(request_start_spread_ms, 3)
        print(json.dumps({"runs": out, "summary": summary}, indent=2))
        return
    if args.output == "csv":
        print("run_id,run_id_short,time_to_start_sec,status,assigned_pod")
        for r in results:
            sec = "" if r[2] is None else f"{r[2]:.3f}"
            pod = r[4] or ""
            print(f"{r[0]},{r[1]},{sec},{r[3]},{pod}")
        return

    # text
    title = f"Workflow Start Latency (concurrent={n}, warm_pool_size={warm})"
    if args.simultaneous:
        title += " [simultaneous]"
    print(title)
    print("=" * 60)
    if request_start_spread_ms is not None:
        print(f"Request start spread: {request_start_spread_ms:.2f} ms (all POSTs fired in same barrier)")
        print()
    print(f"{'run_id':<14} {'time_to_start':<14} {'status':<10} pod")
    for r in results:
        short_id, sec, status, pod = r[1], r[2], r[3], r[4]
        sec_str = f"{sec:.2f}s" if sec is not None else "—"
        pod_str = pod or ""
        # Label cold: after first `warm` by latency order
        idx = results.index(r)
        cold_label = " (cold)" if idx >= warm and sec is not None else ""
        print(f"{short_id:<14} {sec_str:<14} {status:<10} {pod_str}{cold_label}")
    print()
    print("Summary")
    print("-------")
    if valid_secs:
        print(f"min:     {min(valid_secs):.2f}s")
        print(f"median:  {median(valid_secs):.2f}s")
        print(f"max:     {max(valid_secs):.2f}s")
        print(f"p95:     {_p95(valid_secs):.2f}s")
        if len(valid_secs) >= warm:
            warm_secs = valid_secs[:warm]
            cold_secs = valid_secs[warm:]
            if cold_secs:
                print(f"\nWarm (first {warm}): ~{min(warm_secs):.2f}–{max(warm_secs):.2f}s  |  Cold (rest): ~{min(cold_secs):.2f}–{max(cold_secs):.2f}s")
    else:
        print("No successful time_to_start values.")


if __name__ == "__main__":
    main()
