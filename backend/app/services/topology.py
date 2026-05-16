"""
Topology Builder Service
Reconstructs network topology from scan data using graph theory.
Computes centrality metrics for enhanced risk scoring.
"""

import logging
from typing import Dict, List, Any , Optional
import networkx as nx

logger = logging.getLogger(__name__)


class TopologyBuilder:

    def build(self, devices: List[Dict]) -> Dict[str, Any]:
        """Build graph topology and compute centrality for all devices."""
        if not devices:
            return {"nodes": [], "edges": [], "metrics": {}}

        G = nx.Graph()

        nodes = []
        edges = []

        # Build nodes
        ip_to_id = {}
        for dev in devices:
            node_id = dev.get("device_id") or dev["ip"]
            ip_to_id[dev["ip"]] = node_id

            # Estimate layer based on device type and ports
            layer = self._estimate_layer(dev)

            G.add_node(node_id, ip=dev["ip"], device_type=dev.get("device_type", "unknown"), layer=layer)
            nodes.append({
                "id": node_id,
                "ip": dev["ip"],
                "hostname": dev.get("hostname") or dev["ip"],
                "device_type": dev.get("device_type", "unknown"),
                "os_name": dev.get("os_name"),
                "vendor": dev.get("vendor"),
                "open_ports_count": len(dev.get("ports", [])),
                "layer": layer,
                "x": None, "y": None, "z": None,  # Set by frontend 3D layout
            })

        # Infer edges: gateway connects to all, hosts on same subnet connect
        gateway = self._find_gateway(devices)

        for dev in devices:
            node_id = ip_to_id[dev["ip"]]
            if gateway and dev["ip"] != gateway["ip"]:
                src = ip_to_id[gateway["ip"]]
                tgt = node_id
                if not G.has_edge(src, tgt):
                    G.add_edge(src, tgt, weight=1)
                    edges.append({"source": src, "target": tgt, "type": "network"})
            elif not gateway and len(devices) > 1:
                # Flat topology - star from first device
                if dev != devices[0]:
                    src = ip_to_id[devices[0]["ip"]]
                    tgt = node_id
                    if not G.has_edge(src, tgt):
                        G.add_edge(src, tgt)
                        edges.append({"source": src, "target": tgt, "type": "network"})

        # Compute centrality
        centrality = {}
        if len(G.nodes) > 1:
            try:
                degree_c = nx.degree_centrality(G)
                between_c = nx.betweenness_centrality(G)
                centrality = {
                    n: (degree_c.get(n, 0) * 0.5 + between_c.get(n, 0) * 0.5)
                    for n in G.nodes
                }
            except Exception as e:
                logger.warning(f"Centrality computation failed: {e}")

        # Embed centrality into nodes
        for node in nodes:
            node["centrality"] = round(centrality.get(node["id"], 0.0), 4)

        return {
            "nodes": nodes,
            "edges": edges,
            "metrics": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "density": round(nx.density(G), 4) if len(G.nodes) > 1 else 0,
                "gateway_ip": gateway["ip"] if gateway else None,
            }
        }

    def _find_gateway(self, devices: List[Dict]) -> Optional[Dict]:
        for dev in devices:
            ip = dev["ip"]
            # Common gateway heuristic: ends in .1 or .254
            last_octet = int(ip.split(".")[-1]) if ip.count(".") == 3 else -1
            if last_octet in (1, 254) or dev.get("device_type") in ("router", "firewall"):
                return dev
        return None

    def _estimate_layer(self, dev: Dict) -> int:
        dt = dev.get("device_type", "unknown")
        if dt in ("router", "firewall"):
            return 3
        if dt == "switch":
            return 2
        if dt == "server":
            return 4
        return 3


try:
    from typing import Optional
except ImportError:
    pass
