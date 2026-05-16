import { useRef, useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { topologyApi, scansApi } from '../services/api'
import { Server, Router, Shield, Monitor, Cpu, HelpCircle, Globe, ChevronLeft } from 'lucide-react'

const DEVICE_COLORS = {
  router:      '#00ff9d',
  switch:      '#00aaff',
  server:      '#aa00ff',
  workstation: '#0066ff',
  firewall:    '#ff6600',
  iot:         '#ffaa00',
  unknown:     '#4a5568',
}

const DEVICE_ICONS = {
  router:      Router,
  switch:      Globe,
  server:      Server,
  workstation: Monitor,
  firewall:    Shield,
  iot:         Cpu,
  unknown:     HelpCircle,
}

function NodePanel({ node, onClose }) {
  if (!node) return null
  const color = DEVICE_COLORS[node.device_type] || DEVICE_COLORS.unknown

  return (
    <div className="absolute top-4 right-4 w-72 card border-border/80 shadow-2xl z-10">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-mono font-bold text-sm" style={{ color }}>{node.ip}</span>
        </div>
        <button onClick={onClose} className="text-text-dim hover:text-text text-xs">✕</button>
      </div>
      <div className="p-4 space-y-2 text-xs font-mono">
        {[
          ['Hostname', node.hostname || '—'],
          ['Device Type', node.device_type || 'unknown'],
          ['OS', node.os_name || 'Unknown'],
          ['Vendor', node.vendor || '—'],
          ['Open Ports', node.open_ports_count ?? '—'],
          ['Centrality', node.centrality?.toFixed(4) ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-text-dim">{k}</span>
            <span className="text-text font-medium">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TopologyView() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const graphRef = useRef()
  const [selectedNode, setSelectedNode] = useState(null)
  const [activeScanId, setActiveScanId] = useState(scanId)

  const { data: scans = [] } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list })
  const completedScans = scans.filter(s => s.status === 'completed')

  const { data: topology, isLoading, error } = useQuery({
    queryKey: ['topology', activeScanId],
    queryFn: () => topologyApi.get(activeScanId),
    enabled: !!activeScanId,
  })

  const graphData = topology ? {
    nodes: topology.nodes.map(n => ({
      ...n,
      color: DEVICE_COLORS[n.device_type] || DEVICE_COLORS.unknown,
      val: 1 + (n.open_ports_count || 0) * 0.3 + (n.centrality || 0) * 5,
    })),
    links: topology.edges.map(e => ({
      source: e.source,
      target: e.target,
      color: 'rgba(255,255,255,0.06)',
    }))
  } : { nodes: [], links: [] }

  const nodeThreeObject = useCallback(node => {
    const color = node.color || '#4a5568'
    const size = node.val * 4 || 8
    
    // Glowing sphere
    const geometry = new THREE.SphereGeometry(size, 16, 16)
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.9,
    })
    const mesh = new THREE.Mesh(geometry, material)
    
    // Ring around selected
    if (selectedNode?.id === node.id) {
      const ringGeo = new THREE.TorusGeometry(size * 1.8, 1, 8, 32)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
      mesh.add(new THREE.Mesh(ringGeo, ringMat))
    }
    return mesh
  }, [selectedNode])

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node)
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: node.x * 1.5, y: node.y * 1.5, z: node.z * 1.5 + 80 },
        { x: node.x, y: node.y, z: node.z },
        800
      )
    }
  }, [])

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)] -m-6">
      {/* Top controls bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 flex-wrap">
        {scanId && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 card text-xs font-mono text-text-dim hover:text-primary transition-colors border-border/60"
          >
            <ChevronLeft size={13} /> Back
          </button>
        )}

        {completedScans.length > 0 && (
          <select
            value={activeScanId || ''}
            onChange={e => setActiveScanId(e.target.value)}
            className="select-field w-56 text-xs py-1.5"
          >
            <option value="">— Select Scan —</option>
            {completedScans.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.target_network})</option>
            ))}
          </select>
        )}

        {topology && (
          <div className="card px-3 py-1.5 text-xs font-mono text-text-dim border-border/60 flex items-center gap-3">
            <span><span className="text-primary font-bold">{topology.metrics?.node_count}</span> nodes</span>
            <span><span className="text-accent font-bold">{topology.metrics?.edge_count}</span> edges</span>
            {topology.metrics?.gateway_ip && (
              <span>GW: <span className="text-warn font-bold">{topology.metrics.gateway_ip}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 card p-3 border-border/60">
        <div className="text-[9px] font-mono text-text-dim uppercase tracking-widest mb-2">Device Types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(DEVICE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5 text-[10px] font-mono text-text-dim capitalize">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Node panel */}
      {selectedNode && (
        <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {/* Graph or empty state */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-dim font-mono">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading topology...</span>
          </div>
        </div>
      ) : !activeScanId ? (
        <div className="flex-1 flex items-center justify-center text-text-dim font-mono flex-col gap-3">
          <Globe size={48} className="opacity-20" />
          <p>Select a completed scan to view its network topology.</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-danger font-mono flex-col gap-3">
          <p>Topology data unavailable for this scan.</p>
        </div>
      ) : (
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeLabel={node => `<div style="font-family:JetBrains Mono;font-size:12px;background:#111827;border:1px solid #1f2d3d;padding:8px 12px;border-radius:6px;color:#c8d6e5"><strong style="color:${node.color}">${node.ip}</strong><br/>${node.device_type} · ${node.os_name || 'Unknown OS'}</div>`}
          linkColor={() => 'rgba(0,255,157,0.08)'}
          linkWidth={1.5}
          linkOpacity={0.6}
          backgroundColor="#0a0e1a"
          onNodeClick={handleNodeClick}
          enableNodeDrag={true}
          enableNavigationControls={true}
          showNavInfo={false}
        />
      )}
    </div>
  )
}
