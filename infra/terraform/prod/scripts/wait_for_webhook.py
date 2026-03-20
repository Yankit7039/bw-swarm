"""Poll until the AWS Load Balancer Controller deployment is ready and webhook has caBundle.

Reads CLUSTER_NAME, REGION, NAMESPACE, DEPLOYMENT from environment.
Requires: aws CLI, kubectl, and credentials for the EKS cluster.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

MAX_ATTEMPTS = 30
SLEEP_SEC = 10
WEBHOOK_NAMES = ("aws-load-balancer-controller-webhook", "aws-load-balancer-webhook")


def get_ready_replicas(namespace: str, deployment: str) -> int:
    cmd = [
        "kubectl",
        "get",
        f"deployment/{deployment}",
        "-n",
        namespace,
        "-o",
        "jsonpath={.status.readyReplicas}",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if r.returncode != 0:
        return 0
    out = (r.stdout or "").strip()
    if not out:
        return 0
    try:
        return int(out)
    except ValueError:
        return 0


def webhook_has_cabundle() -> bool:
    """Check if any ALB controller MutatingWebhookConfiguration has non-empty caBundle."""
    for name in WEBHOOK_NAMES:
        cmd = [
            "kubectl",
            "get",
            "mutatingwebhookconfiguration",
            name,
            "-o",
            "jsonpath={.webhooks[0].clientConfig.caBundle}",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if r.returncode == 0 and (r.stdout or "").strip():
            return True
    return False


def main() -> None:
    cluster = os.environ.get("CLUSTER_NAME")
    region = os.environ.get("REGION")
    namespace = os.environ.get("NAMESPACE")
    deployment = os.environ.get("DEPLOYMENT")

    missing = [k for k, v in [("CLUSTER_NAME", cluster), ("REGION", region), ("NAMESPACE", namespace), ("DEPLOYMENT", deployment)] if not v]
    if missing:
        print(f"Missing env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(2)

    update_cmd = [
        "aws",
        "eks",
        "update-kubeconfig",
        "--name",
        cluster,
        "--region",
        region,
    ]
    r = subprocess.run(update_cmd, capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print(f"update-kubeconfig failed: {r.stderr or r.stdout}", file=sys.stderr)
        sys.exit(2)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        ready = get_ready_replicas(namespace, deployment)
        if ready >= 1 and webhook_has_cabundle():
            print(f"Deployment {deployment} and webhook ready after {attempt} attempt(s).", file=sys.stderr)
            return
        if ready >= 1 and not webhook_has_cabundle():
            print(f"Waiting for webhook caBundle ({attempt}/{MAX_ATTEMPTS})...", file=sys.stderr)
        else:
            print(f"Waiting for {deployment} ({attempt}/{MAX_ATTEMPTS})...", file=sys.stderr)
        time.sleep(SLEEP_SEC)

    print(f"Timeout waiting for {deployment} deployment and webhook.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
