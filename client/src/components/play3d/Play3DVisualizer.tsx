import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Video } from "lucide-react";
import {
  getOffensivePlayers,
  getDefensivePlayers,
  interpolateRoute,
  type PlayerPos,
} from "@/components/gameplan/FormationDiagram";

interface Play3DVisualizerProps {
  formation: string;
  playName: string;
  playType: string;
  target?: string;
  defenseScheme?: string;
  /** Optional custom players (overrides formation-derived ones) */
  customPlayers?: PlayerPos[];
  /** Height of the canvas in px */
  height?: number;
}

type CameraPreset = "sideline" | "endzone" | "birdseye" | "qb";

// Field dimensions in 3D world units (1 unit = 1 yard-ish)
const FIELD_W = 53.3; // width (sideline to sideline)
const FIELD_L = 60; // visible length of field section
const LOS_Z = 0; // line of scrimmage at z=0

// Convert 2D diagram coords (x: 0-100 across field, y: 0-85 depth; LOS at y=50)
// to 3D world coords: x → world X (centered), y → world Z (LOS at 0, offense positive Z)
function to3D(x: number, y: number): { x: number; z: number } {
  return {
    x: ((x - 50) / 100) * FIELD_W,
    z: ((y - 50) / 85) * FIELD_L * 1.4,
  };
}

function makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 6;
  ctx.fillText(text, 64, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 1.6, 1);
  return sprite;
}

interface PlayerMesh {
  group: THREE.Group;
  data: PlayerPos;
  trail: THREE.Line | null;
  trailPoints: THREE.Vector3[];
}

export default function Play3DVisualizer({
  formation,
  playName,
  playType,
  target,
  defenseScheme,
  customPlayers,
  height = 480,
}: Play3DVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    players: PlayerMesh[];
    animId: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>("sideline");
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const [speed, setSpeed] = useState(1);
  const PLAY_DURATION = 3000;

  const applyPreset = useCallback((p: CameraPreset) => {
    const s = sceneRef.current;
    if (!s) return;
    setPreset(p);
    const cam = s.camera;
    switch (p) {
      case "sideline":
        cam.position.set(48, 22, 6);
        break;
      case "endzone":
        cam.position.set(0, 16, 42);
        break;
      case "birdseye":
        cam.position.set(0, 55, 0.1);
        break;
      case "qb":
        cam.position.set(0, 5, 16);
        break;
    }
    s.controls.target.set(0, 0, 0);
    s.controls.update();
  }, []);

  // Build scene once per formation change
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);
    scene.fog = new THREE.Fog(0x0a1628, 80, 160);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    camera.position.set(48, 22, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 8;
    controls.maxDistance = 120;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(30, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // Stadium light glows
    [[-40, 30, -40], [40, 30, -40], [-40, 30, 40], [40, 30, 40]].forEach(([x, y, z]) => {
      const pt = new THREE.PointLight(0xfff4d6, 0.35, 120);
      pt.position.set(x, y, z);
      scene.add(pt);
    });

    // ===== Field =====
    const fieldGeo = new THREE.PlaneGeometry(FIELD_W + 14, FIELD_L * 2.2);
    // Striped grass texture via canvas
    const grassCanvas = document.createElement("canvas");
    grassCanvas.width = 256;
    grassCanvas.height = 1024;
    const gctx = grassCanvas.getContext("2d")!;
    for (let i = 0; i < 16; i++) {
      gctx.fillStyle = i % 2 === 0 ? "#1c5c2a" : "#175024";
      gctx.fillRect(0, i * 64, 256, 64);
    }
    const grassTex = new THREE.CanvasTexture(grassCanvas);
    const fieldMat = new THREE.MeshLambertMaterial({ map: grassTex });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    // Yard lines every 5 yards
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    for (let z = -50; z <= 50; z += 5) {
      const lineGeo = new THREE.PlaneGeometry(FIELD_W, 0.25);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      scene.add(line);
    }

    // Line of scrimmage (gold)
    const losGeo = new THREE.PlaneGeometry(FIELD_W, 0.4);
    const losMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
    const los = new THREE.Mesh(losGeo, losMat);
    los.rotation.x = -Math.PI / 2;
    los.position.set(0, 0.03, LOS_Z);
    scene.add(los);

    // Sidelines
    const sideMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    [-FIELD_W / 2, FIELD_W / 2].forEach((x) => {
      const sGeo = new THREE.PlaneGeometry(0.5, FIELD_L * 2.2);
      const sMesh = new THREE.Mesh(sGeo, sideMat);
      sMesh.rotation.x = -Math.PI / 2;
      sMesh.position.set(x, 0.02, 0);
      scene.add(sMesh);
    });

    // Hash marks
    for (let z = -50; z <= 50; z += 1) {
      if (z % 5 === 0) continue;
      [-3.1, 3.1].forEach((x) => {
        const hGeo = new THREE.PlaneGeometry(0.7, 0.12);
        const h = new THREE.Mesh(hGeo, lineMat);
        h.rotation.x = -Math.PI / 2;
        h.position.set(x, 0.02, z);
        scene.add(h);
      });
    }

    // ===== Players =====
    const offense = customPlayers
      ? customPlayers.filter((p) => p.side === "offense")
      : getOffensivePlayers(formation, playType, target);
    const defense = customPlayers
      ? customPlayers.filter((p) => p.side === "defense")
      : getDefensivePlayers(defenseScheme);
    const allPlayers = [...offense, ...defense];

    const players: PlayerMesh[] = allPlayers.map((p) => {
      const group = new THREE.Group();
      const isOff = p.side === "offense";
      const color = isOff ? 0x00ff87 : 0xff4757;

      // Body: capsule-ish (cylinder + sphere head)
      const bodyGeo = new THREE.CylinderGeometry(0.55, 0.65, 1.6, 12);
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.8;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(0.42, 14, 12);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xf5d0a9, roughness: 0.7 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.95;
      head.castShadow = true;
      group.add(head);

      // Helmet
      const helmGeo = new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
      const helmMat = new THREE.MeshStandardMaterial({ color: isOff ? 0x0e7a44 : 0x8b1f2b, roughness: 0.3, metalness: 0.4 });
      const helm = new THREE.Mesh(helmGeo, helmMat);
      helm.position.y = 2.02;
      group.add(helm);

      // Label sprite above head
      const sprite = makeTextSprite(p.label, isOff ? "#00FF87" : "#FF6B7A");
      sprite.position.y = 3.2;
      group.add(sprite);

      // Position ring on ground
      const ringGeo = new THREE.RingGeometry(0.8, 1.0, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      group.add(ring);

      const pos = to3D(p.x, p.y);
      group.position.set(pos.x, 0, pos.z);
      scene.add(group);

      return { group, data: p, trail: null, trailPoints: [] };
    });

    // Football at LOS center
    const ballGeo = new THREE.SphereGeometry(0.35, 12, 8);
    ballGeo.scale(1.5, 1, 1);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(0, 0.35, LOS_Z);
    ball.castShadow = true;
    scene.add(ball);

    sceneRef.current = { scene, camera, renderer, controls, players, animId: 0 };

    // ===== Animation loop =====
    let lastTime = performance.now();
    const tick = (now: number) => {
      const s = sceneRef.current;
      if (!s) return;
      const dt = now - lastTime;
      lastTime = now;

      if (playingRef.current) {
        progressRef.current = Math.min(progressRef.current + (dt / PLAY_DURATION) * speedRef.current, 1);
        if (progressRef.current >= 1) {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }

      const prog = progressRef.current;
      for (const pm of s.players) {
        const { data } = pm;
        if (data.route && data.route.points.length > 0) {
          const pos2d = interpolateRoute(data.x, data.y, data.route.points, prog);
          const pos = to3D(pos2d.x, pos2d.y);
          pm.group.position.set(pos.x, 0, pos.z);

          // Trail
          if (prog > 0.01) {
            pm.trailPoints.push(new THREE.Vector3(pos.x, 0.1, pos.z));
            if (pm.trailPoints.length > 120) pm.trailPoints.shift();
            if (pm.trail) s.scene.remove(pm.trail);
            if (pm.trailPoints.length > 1) {
              const tGeo = new THREE.BufferGeometry().setFromPoints(pm.trailPoints);
              const tMat = new THREE.LineBasicMaterial({
                color: data.side === "offense" ? 0x00ff87 : 0xff4757,
                transparent: true,
                opacity: 0.7,
              });
              pm.trail = new THREE.Line(tGeo, tMat);
              s.scene.add(pm.trail);
            }
          } else if (prog === 0 && pm.trail) {
            s.scene.remove(pm.trail);
            pm.trail = null;
            pm.trailPoints = [];
          }

          // Slight running bob
          if (playingRef.current && prog > 0 && prog < 1) {
            pm.group.position.y = Math.abs(Math.sin(now * 0.02)) * 0.15;
          } else {
            pm.group.position.y = 0;
          }
        }
      }

      s.controls.update();
      s.renderer.render(s.scene, s.camera);
      s.animId = requestAnimationFrame(tick);
    };
    sceneRef.current.animId = requestAnimationFrame(tick);

    // Resize handler
    const onResize = () => {
      const s = sceneRef.current;
      if (!s || !mount) return;
      const w = mount.clientWidth;
      s.camera.aspect = w / height;
      s.camera.updateProjectionMatrix();
      s.renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      const s = sceneRef.current;
      if (s) {
        cancelAnimationFrame(s.animId);
        s.renderer.dispose();
        s.controls.dispose();
        if (mount.contains(s.renderer.domElement)) mount.removeChild(s.renderer.domElement);
      }
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formation, playType, target, defenseScheme, customPlayers, height]);

  const handlePlay = useCallback(() => {
    if (playingRef.current) {
      playingRef.current = false;
      setIsPlaying(false);
    } else {
      if (progressRef.current >= 1) progressRef.current = 0;
      playingRef.current = true;
      setIsPlaying(true);
    }
  }, []);

  const handleReset = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    progressRef.current = 0;
  }, []);

  const cycleSpeed = useCallback(() => {
    const next = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1;
    setSpeed(next);
    speedRef.current = next;
  }, [speed]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a1628]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[#00FF87]" />
          <span className="font-bold text-white text-sm">{playName}</span>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{formation}</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400 uppercase">{playType}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handlePlay}>
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isPlaying ? "Pause" : "Run Play"}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs w-12" onClick={cycleSpeed}>
            {speed}x
          </Button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div ref={mountRef} style={{ height }} className="w-full relative" />

      {/* Camera presets */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-t border-gray-800 flex-wrap">
        <span className="text-[11px] text-gray-500 mr-1 uppercase tracking-wide">Camera:</span>
        {(["sideline", "endzone", "birdseye", "qb"] as CameraPreset[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={preset === p ? "default" : "outline"}
            className="h-6 text-[11px] px-2.5 capitalize"
            onClick={() => applyPreset(p)}
          >
            {p === "qb" ? "QB View" : p === "birdseye" ? "Bird's Eye" : p === "endzone" ? "End Zone" : "Sideline"}
          </Button>
        ))}
        <span className="text-[10px] text-gray-600 ml-auto hidden sm:inline">Drag to rotate · Scroll to zoom</span>
      </div>
    </div>
  );
}
