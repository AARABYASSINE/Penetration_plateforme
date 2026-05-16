#!/usr/bin/env python3
"""
Scapy-based Network Discovery Script
Performs ARP sweep for host discovery within a subnet.
Run with root privileges: sudo python3 scapy_discovery.py --target 192.168.1.0/24

Output is JSON-formatted for import into the PenTest Platform API.
"""

import argparse
import json
import sys
import logging
from typing import List, Dict

try:
    from scapy.all import ARP, Ether, srp, conf
    conf.verb = 0
except ImportError:
    print("[ERROR] Scapy not installed. Run: pip install scapy")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def arp_sweep(target: str, timeout: int = 2, retry: int = 1) -> List[Dict]:
    """
    Perform ARP sweep on target subnet.
    Returns list of {ip, mac} dicts for live hosts.
    """
    logger.info(f"Starting ARP sweep on {target}")

    arp = ARP(pdst=target)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp

    answered, unanswered = srp(packet, timeout=timeout, retry=retry, verbose=False)

    hosts = []
    for sent, received in answered:
        hosts.append({
            "ip": received.psrc,
            "mac": received.hwsrc,
        })
        logger.info(f"  Found: {received.psrc} ({received.hwsrc})")

    logger.info(f"Discovered {len(hosts)} hosts.")
    return hosts


def main():
    parser = argparse.ArgumentParser(description="Scapy ARP Network Discovery")
    parser.add_argument("--target", required=True, help="Target network CIDR (e.g. 192.168.1.0/24)")
    parser.add_argument("--timeout", type=int, default=2, help="ARP timeout in seconds")
    parser.add_argument("--output", help="Output JSON file path (default: stdout)")
    args = parser.parse_args()

    hosts = arp_sweep(args.target, timeout=args.timeout)

    result = {
        "target": args.target,
        "hosts_found": len(hosts),
        "hosts": hosts
    }

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2)
        logger.info(f"Results saved to {args.output}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    import os
    if os.geteuid() != 0:
        print("[WARNING] ARP scanning requires root privileges. Run with sudo.")
    main()
