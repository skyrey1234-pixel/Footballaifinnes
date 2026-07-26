import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Video, Eye, EyeOff } from "lucide-react";
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
  /** Animate the ball: QB throw arc for pass plays, RB carry for runs */
  showBall?: boolean;
  /** Annotation markers: red = mistake spot, green = correct spot (2D diagram coords) */
  annotations?: Array<{ kind: "wrong" | "right"; x: number; y: number; label: string }>;
  /** Optional wrong-path line: dashed red line from LOS breakdown showing the mistaken path (2D coords) */
  wrongPath?: Array<[number, number]>;
  /** Optional correct-path line: solid green line showing the right execution (2D coords) */
  correctPath?: Array<[number, number]>;
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
  /** Full-route preview line that draws in as the player runs it */
  routeLine: THREE.Line | null;
  routeWorldPts: THREE.Vector3[];
  /** Glowing tracking ring that follows key players */
  trackRing: THREE.Mesh | null;
}

export default function Play3DVisualizer({
  formation,
  playName,
  playType,
  target,
  defenseScheme,
  customPlayers,
  height = 480,
  showBall = true,
  annotations,
  wrongPath,
  correctPath,
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
  const [scrub, setScrub] = useState(0); // 0-100 mirrored for the timeline UI
  const [showRoutes, setShowRoutes] = useState(true);
  const showRoutesRef = useRef(true);
  const [showCorrect, setShowCorrect] = useState(true);
  const showCorrectRef = useRef(true);
  const PLAY_DURATION = 3000;

  const phaseLabel = scrub < 5 ? "PRE-SNAP" : scrub < 45 ? "DEVELOPMENT" : scrub < 90 ? "BALL IN FLIGHT" : "RESULT";

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

      // Precompute the full route in world coords (for live route drawing)
      const routeWorldPts: THREE.Vector3[] = [];
      if (p.route && p.route.points.length > 0) {
        const SEGMENTS = 60;
        for (let i = 0; i <= SEGMENTS; i++) {
          const rp = interpolateRoute(p.x, p.y, p.route.points, i / SEGMENTS);
          const w = to3D(rp.x, rp.y);
          routeWorldPts.push(new THREE.Vector3(w.x, 0.09, w.z));
        }
      }

      // Glowing tracking ring for key skill players (anyone with a route)
      let trackRing: THREE.Mesh | null = null;
      if (p.route && p.route.points.length > 0) {
        const trGeo = new THREE.RingGeometry(1.15, 1.5, 32);
        const trMat = new THREE.MeshBasicMaterial({
          color: isOff ? 0x00ff87 : 0xff4757,
          transparent: true,
          opacity: 0.0, // fades in when the play runs
          side: THREE.DoubleSide,
        });
        trackRing = new THREE.Mesh(trGeo, trMat);
        trackRing.rotation.x = -Math.PI / 2;
        trackRing.position.set(pos.x, 0.05, pos.z);
        scene.add(trackRing);
      }

      return { group, data: p, trail: null, trailPoints: [], routeLine: null, routeWorldPts, trackRing };
    });

    // Football at LOS center
    const ballGeo = new THREE.SphereGeometry(0.35, 12, 8);
    ballGeo.scale(1.5, 1, 1);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(0, 0.35, LOS_Z);
    ball.castShadow = true;
    scene.add(ball);

    // ===== Ball flight plan =====
    // Pass: released at 45% progress, parabolic arc from QB to the primary target's route end.
    // Run: ball rides with the RB along his route.
    let ballPlan: { mode: "throw"; from: THREE.Vector3; to: THREE.Vector3 } | { mode: "carry"; carrier: PlayerMesh } | null = null;
    if (showBall) {
      const qbData = offense.find((p) => p.label === "QB");
      if (playType === "run") {
        const rbMesh = players.find((pm) => pm.data.label === "RB" && pm.data.route);
        if (rbMesh) ballPlan = { mode: "carry", carrier: rbMesh };
      } else if (qbData) {
        const receivers = offense.filter((p) => p.route && p.route.type === "route" && p.label !== "QB");
        if (receivers.length > 0) {
          let primary = receivers[0];
          const t = (target || "").toLowerCase();
          const byLabel = t ? receivers.find((r) => t.includes(r.label.toLowerCase())) : undefined;
          if (byLabel) primary = byLabel;
          else primary = receivers.reduce((best, r) => {
            const endY = r.route!.points[r.route!.points.length - 1][1];
            const bestY = best.route!.points[best.route!.points.length - 1][1];
            return endY < bestY ? r : best;
          }, receivers[0]);
          const qb3 = to3D(qbData.x, qbData.y);
          const end = primary.route!.points[primary.route!.points.length - 1];
          const end3 = to3D(end[0], end[1]);
          ballPlan = {
            mode: "throw",
            from: new THREE.Vector3(qb3.x, 1.8, qb3.z),
            to: new THREE.Vector3(end3.x, 1.2, end3.z),
          };
          // Gold dashed throw-lane preview on the ground
          const laneOnGround = [
            new THREE.Vector3(qb3.x, 0.06, qb3.z),
            new THREE.Vector3(end3.x, 0.06, end3.z),
          ];
          const laneGeo = new THREE.BufferGeometry().setFromPoints(laneOnGround);
          const laneMat = new THREE.LineDashedMaterial({ color: 0xffd700, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.55 });
          const lane = new THREE.Line(laneGeo, laneMat);
          lane.computeLineDistances();
          scene.add(lane);
          // Catch-point ring
          const cpGeo = new THREE.RingGeometry(1.1, 1.4, 28);
          const cpMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
          const cp = new THREE.Mesh(cpGeo, cpMat);
          cp.rotation.x = -Math.PI / 2;
          cp.position.set(end3.x, 0.05, end3.z);
          scene.add(cp);
        }
      }
    }

    // ===== Wrong/Right annotation rings =====
    const annotationRings: Array<{ mesh: THREE.Mesh; base: number }> = [];
    (annotations || []).forEach((a) => {
      const pos = to3D(a.x, a.y);
      const color = a.kind === "wrong" ? 0xff3344 : 0x00ff87;
      const ringGeo = new THREE.RingGeometry(1.6, 2.1, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.07, pos.z);
      scene.add(ring);
      annotationRings.push({ mesh: ring, base: 1.85 });
      // Vertical beacon beam
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 5, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(pos.x, 2.5, pos.z);
      scene.add(beam);
      // Floating label
      const label = makeTextSprite(a.label.slice(0, 14), a.kind === "wrong" ? "#FF5566" : "#00FF87");
      label.position.set(pos.x, 5.6, pos.z);
      label.scale.set(6.5, 3.2, 1);
      scene.add(label);
    });

    // ===== Wrong-path line (dashed red, draws in as play progresses) =====
    let wrongLine: THREE.Line | null = null;
    let wrongWorldPts: THREE.Vector3[] = [];
    if (wrongPath && wrongPath.length > 1) {
      wrongWorldPts = wrongPath.map(([wx, wy]) => {
        const w = to3D(wx, wy);
        return new THREE.Vector3(w.x, 0.12, w.z);
      });
      // X marker at the end of the wrong path
      const endW = wrongWorldPts[wrongWorldPts.length - 1];
      const xLabel = makeTextSprite("✕", "#FF3344");
      xLabel.position.set(endW.x, 1.4, endW.z);
      xLabel.scale.set(2.4, 1.2, 1);
      scene.add(xLabel);
    }

    // ===== Correct-path line (solid green, toggleable) =====
    let correctLine: THREE.Line | null = null;
    let correctWorldPts: THREE.Vector3[] = [];
    let correctArrow: THREE.Mesh | null = null;
    if (correctPath && correctPath.length > 1) {
      correctWorldPts = correctPath.map(([cx, cy]) => {
        const w = to3D(cx, cy);
        return new THREE.Vector3(w.x, 0.12, w.z);
      });
      // Arrowhead cone at the end of the correct path
      const last = correctWorldPts[correctWorldPts.length - 1];
      const prev = correctWorldPts[correctWorldPts.length - 2];
      const dir = new THREE.Vector3().subVectors(last, prev).normalize();
      const coneGeo = new THREE.ConeGeometry(0.5, 1.4, 10);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x00ff87, transparent: true, opacity: 0.9 });
      correctArrow = new THREE.Mesh(coneGeo, coneMat);
      correctArrow.position.copy(last).setY(0.3);
      correctArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir.x, 0, dir.z).normalize());
      scene.add(correctArrow);
    }

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
        setScrub(Math.round(progressRef.current * 100));
      }

      const prog = progressRef.current;
      for (const pm of s.players) {
        const { data } = pm;
        if (data.route && data.route.points.length > 0) {
          const pos2d = interpolateRoute(data.x, data.y, data.route.points, prog);
          const pos = to3D(pos2d.x, pos2d.y);
          pm.group.position.set(pos.x, 0, pos.z);

          // Live route line: draws in slightly ahead of the runner (glowing preview)
          if (showRoutesRef.current && pm.routeWorldPts.length > 1 && prog > 0.01) {
            const drawTo = Math.min(Math.floor((prog + 0.12) * (pm.routeWorldPts.length - 1)) + 1, pm.routeWorldPts.length);
            if (pm.routeLine) s.scene.remove(pm.routeLine);
            const rlGeo = new THREE.BufferGeometry().setFromPoints(pm.routeWorldPts.slice(0, drawTo));
            const rlMat = new THREE.LineDashedMaterial({
              color: data.side === "offense" ? 0x39ffb0 : 0xff7788,
              dashSize: 0.9,
              gapSize: 0.5,
              transparent: true,
              opacity: 0.5,
            });
            pm.routeLine = new THREE.Line(rlGeo, rlMat);
            pm.routeLine.computeLineDistances();
            s.scene.add(pm.routeLine);
          } else if ((prog === 0 || !showRoutesRef.current) && pm.routeLine) {
            s.scene.remove(pm.routeLine);
            pm.routeLine = null;
          }

          // Tracking ring follows the player, pulses while running
          if (pm.trackRing) {
            pm.trackRing.position.set(pos.x, 0.05, pos.z);
            const mat = pm.trackRing.material as THREE.MeshBasicMaterial;
            if (prog > 0 && prog < 1) {
              const ringPulse = 1 + Math.sin(now * 0.008) * 0.22;
              pm.trackRing.scale.set(ringPulse, ringPulse, 1);
              mat.opacity = 0.55 + Math.sin(now * 0.008) * 0.25;
            } else {
              mat.opacity = prog >= 1 ? 0.35 : 0.0;
              pm.trackRing.scale.set(1, 1, 1);
            }
          }

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

      // Animate ball flight
      if (ballPlan) {
        if (ballPlan.mode === "carry") {
          const c = ballPlan.carrier;
          ball.position.set(c.group.position.x, 1.0 + c.group.position.y, c.group.position.z);
          if (prog > 0 && prog < 1) ball.rotation.z += 0.15;
        } else {
          const RELEASE = 0.45;
          if (prog <= RELEASE) {
            // Ball stays with QB pre-release (track QB mesh if he moves)
            ball.position.set(ballPlan.from.x, prog > 0 ? 1.8 : 0.35, ballPlan.from.z);
          } else {
            const t = Math.min((prog - RELEASE) / (1 - RELEASE), 1);
            const x = ballPlan.from.x + (ballPlan.to.x - ballPlan.from.x) * t;
            const z = ballPlan.from.z + (ballPlan.to.z - ballPlan.from.z) * t;
            const dist = ballPlan.from.distanceTo(ballPlan.to);
            const peak = Math.min(3 + dist * 0.22, 11);
            const y = ballPlan.from.y + (ballPlan.to.y - ballPlan.from.y) * t + peak * 4 * t * (1 - t);
            ball.position.set(x, y, z);
            ball.rotation.x += 0.35; // spiral
          }
        }
      }

      // Pulse annotation rings
      if (annotationRings.length > 0) {
        const pulse = 1 + Math.sin(now * 0.004) * 0.18;
        for (const ar of annotationRings) {
          ar.mesh.scale.set(pulse, pulse, 1);
          (ar.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(now * 0.004) * 0.3;
        }
      }

      // Wrong-path dashed red line: draws in during the second half of the play
      if (wrongWorldPts.length > 1) {
        const wProg = Math.max(0, Math.min((prog - 0.35) / 0.5, 1));
        if (wrongLine) { s.scene.remove(wrongLine); wrongLine = null; }
        if (wProg > 0.02) {
          const drawTo = Math.max(2, Math.ceil(wProg * wrongWorldPts.length));
          const wGeo = new THREE.BufferGeometry().setFromPoints(wrongWorldPts.slice(0, drawTo));
          const wMat = new THREE.LineDashedMaterial({ color: 0xff3344, dashSize: 1.0, gapSize: 0.6, transparent: true, opacity: 0.9, linewidth: 2 });
          wrongLine = new THREE.Line(wGeo, wMat);
          wrongLine.computeLineDistances();
          s.scene.add(wrongLine);
        }
      }

      // Correct-path solid green line: draws in after the wrong path, toggleable
      if (correctWorldPts.length > 1) {
        const cProg = showCorrectRef.current ? Math.max(0, Math.min((prog - 0.5) / 0.5, 1)) : 0;
        if (correctLine) { s.scene.remove(correctLine); correctLine = null; }
        if (correctArrow) correctArrow.visible = false;
        if (cProg > 0.02) {
          const drawTo = Math.max(2, Math.ceil(cProg * correctWorldPts.length));
          const cGeo = new THREE.BufferGeometry().setFromPoints(correctWorldPts.slice(0, drawTo));
          const cMat = new THREE.LineBasicMaterial({ color: 0x00ff87, transparent: true, opacity: 0.95 });
          correctLine = new THREE.Line(cGeo, cMat);
          s.scene.add(correctLine);
          if (correctArrow && cProg >= 1) {
            correctArrow.visible = true;
            const glowPulse = 1 + Math.sin(now * 0.006) * 0.15;
            correctArrow.scale.set(glowPulse, glowPulse, glowPulse);
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
  }, [formation, playType, target, defenseScheme, customPlayers, height, showBall, annotations, wrongPath, correctPath]);

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
    setScrub(0);
  }, []);

  const handleScrub = useCallback((v: number) => {
    playingRef.current = false;
    setIsPlaying(false);
    progressRef.current = v / 100;
    setScrub(v);
  }, []);

  const toggleRoutes = useCallback(() => {
    setShowRoutes((r) => {
      showRoutesRef.current = !r;
      return !r;
    });
  }, []);

  const toggleCorrect = useCallback(() => {
    setShowCorrect((c) => {
      showCorrectRef.current = !c;
      return !c;
    });
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

      {/* Timeline scrubber + phase */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-800 bg-[#0c1a2e]">
        <span className="text-[10px] font-bold tracking-widest text-[#00FF87] w-24 shrink-0">{phaseLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={scrub}
          onChange={(e) => handleScrub(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[#00FF87] cursor-pointer"
          aria-label="Play timeline scrubber"
        />
        <span className="text-[10px] text-gray-500 w-9 text-right tabular-nums">{scrub}%</span>
        <Button
          size="sm"
          variant="outline"
          className={`h-6 gap-1 text-[10px] px-2 ${showRoutes ? "border-[#00FF87]/50 text-[#00FF87]" : "text-gray-500"}`}
          onClick={toggleRoutes}
        >
          {showRoutes ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Routes
        </Button>
        {correctPath && correctPath.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            className={`h-6 gap-1 text-[10px] px-2 ${showCorrect ? "border-[#00FF87]/50 text-[#00FF87]" : "text-gray-500"}`}
            onClick={toggleCorrect}
          >
            {showCorrect ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Fix
          </Button>
        )}
      </div>

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
