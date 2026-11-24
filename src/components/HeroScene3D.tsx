import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const _vecTarget = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface TraceCurveSpec {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
  delay: number;
  speed: number;
}

/**
 * Generates sculptural 3D market trace curves forming a charging bull silhouette:
 * sweeping upward horns, cranial crest, brow, muzzle, jaw, neck hump, and shoulder arc.
 */
function buildBullTraceSpecs(): TraceCurveSpec[] {
  const specs: TraceCurveSpec[] = [];

  // 1. Primary Sweeping Left & Right Horns (upward bullish breakout arcs)
  const rightHornPts = [
    new THREE.Vector3(-0.35, 0.88, 0.35),
    new THREE.Vector3(0.15, 1.35, 0.65),
    new THREE.Vector3(0.85, 1.88, 0.55),
    new THREE.Vector3(1.58, 2.26, 0.15),
    new THREE.Vector3(2.05, 2.65, -0.35),
  ];
  const leftHornPts = [
    new THREE.Vector3(-0.75, 0.86, -0.25),
    new THREE.Vector3(-1.18, 1.32, -0.55),
    new THREE.Vector3(-1.55, 1.92, -0.45),
    new THREE.Vector3(-1.42, 2.45, -0.05),
    new THREE.Vector3(-1.05, 2.75, 0.25),
  ];

  // Add layered parallel market trace harmonics for both horns
  [-0.08, 0, 0.08].forEach((offset, idx) => {
    specs.push({
      points: rightHornPts.map(
        (p, i) => new THREE.Vector3(p.x + offset * 0.6, p.y + offset * (1 + i * 0.12), p.z + offset)
      ),
      color: idx === 1 ? '#A5EBC3' : '#36C982',
      opacity: idx === 1 ? 0.95 : 0.52,
      delay: 0.25 + idx * 0.06,
      speed: 0.55 + idx * 0.1,
    });
    specs.push({
      points: leftHornPts.map(
        (p, i) => new THREE.Vector3(p.x - offset * 0.5, p.y + offset * (1 + i * 0.12), p.z - offset)
      ),
      color: idx === 1 ? '#A5EBC3' : '#36C982',
      opacity: idx === 1 ? 0.9 : 0.48,
      delay: 0.28 + idx * 0.06,
      speed: 0.5 + idx * 0.1,
    });
  });

  // 2. Sculptural Cranial Crest, Brow Ridge & Snout Profile (facing forward-left toward viewer)
  const crestToSnout = [
    new THREE.Vector3(0.35, 1.05, -0.45),
    new THREE.Vector3(-0.25, 0.98, 0.12),
    new THREE.Vector3(-0.78, 0.65, 0.58),
    new THREE.Vector3(-1.22, 0.05, 0.92),
    new THREE.Vector3(-1.42, -0.55, 1.12),
    new THREE.Vector3(-1.18, -0.82, 1.02),
  ];
  [-0.14, 0, 0.14].forEach((off, idx) => {
    specs.push({
      points: crestToSnout.map(
        (p) => new THREE.Vector3(p.x + off * 0.5, p.y + off * 0.4, p.z + off * 0.7)
      ),
      color: idx === 1 ? '#A5EBC3' : '#36C982',
      opacity: idx === 1 ? 0.92 : 0.45,
      delay: 0.18 + idx * 0.05,
      speed: 0.45,
    });
  });

  // 3. Muscular Neck Crest & Charging Shoulder Contour (sweeping right/back)
  const shoulderArcs = [
    [
      new THREE.Vector3(-0.15, 0.92, -0.1),
      new THREE.Vector3(0.65, 1.25, -0.45),
      new THREE.Vector3(1.55, 1.15, -0.65),
      new THREE.Vector3(2.35, 0.55, -0.75),
      new THREE.Vector3(2.75, -0.35, -0.85),
    ],
    [
      new THREE.Vector3(-0.45, 0.45, 0.25),
      new THREE.Vector3(0.42, 0.78, -0.15),
      new THREE.Vector3(1.38, 0.68, -0.38),
      new THREE.Vector3(2.15, 0.12, -0.52),
      new THREE.Vector3(2.52, -0.68, -0.62),
    ],
    [
      new THREE.Vector3(-0.85, -0.15, 0.55),
      new THREE.Vector3(0.05, 0.22, 0.18),
      new THREE.Vector3(0.95, 0.15, -0.12),
      new THREE.Vector3(1.75, -0.35, -0.32),
      new THREE.Vector3(2.18, -1.05, -0.45),
    ],
  ];
  shoulderArcs.forEach((pts, idx) => {
    specs.push({
      points: pts,
      color: idx === 0 ? '#A5EBC3' : '#36C982',
      opacity: idx === 0 ? 0.85 : 0.62,
      delay: 0.34 + idx * 0.07,
      speed: 0.4 + idx * 0.08,
    });
  });

  // 4. Lower Jaw, Dewlap & Chest Market Trace Lines
  const jawToChest = [
    new THREE.Vector3(-1.18, -0.82, 1.02),
    new THREE.Vector3(-0.68, -0.95, 0.68),
    new THREE.Vector3(0.05, -1.25, 0.25),
    new THREE.Vector3(0.85, -1.42, -0.15),
    new THREE.Vector3(1.65, -1.35, -0.48),
  ];
  specs.push({
    points: jawToChest,
    color: '#36C982',
    opacity: 0.8,
    delay: 0.42,
    speed: 0.48,
  });

  // 5. Cheekbone & Eye Orbit Architectural Ribbons
  const browToCheek = [
    new THREE.Vector3(-0.35, 0.72, 0.55),
    new THREE.Vector3(-0.78, 0.32, 0.72),
    new THREE.Vector3(-0.65, -0.25, 0.58),
    new THREE.Vector3(-0.08, -0.58, 0.32),
    new THREE.Vector3(0.62, -0.75, -0.05),
  ];
  specs.push({
    points: browToCheek,
    color: '#A5EBC3',
    opacity: 0.72,
    delay: 0.38,
    speed: 0.52,
  });

  return specs;
}

const SculpturalBullGroup: React.FC<{
  isMobile: boolean;
  introStartRef: React.MutableRefObject<number>;
}> = ({ isMobile, introStartRef }) => {
  const bullGroupRef = useRef<THREE.Group>(null);
  const pulseNodesRef = useRef<THREE.InstancedMesh>(null);
  const traceSpecs = useMemo(() => buildBullTraceSpecs(), []);
  const segmentsPerCurve = isMobile ? 44 : 76;

  const traceEntries = useMemo(() => {
    return traceSpecs.map((spec) => {
      const curve = new THREE.CatmullRomCurve3(spec.points);
      const sampled = curve.getPoints(segmentsPerCurve);
      const geo = new THREE.BufferGeometry().setFromPoints(sampled);
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
      });
      const line = new THREE.Line(geo, mat);
      return { curve, geo, mat, line, spec, totalCount: sampled.length };
    });
  }, [traceSpecs, segmentsPerCurve]);

  // Low-poly sculpted core silhouette planes for directional light + mint rim + dark emerald shadow
  const coreFacetMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#162B20'),
        emissive: new THREE.Color('#0E1D15'),
        emissiveIntensity: 0.45,
        roughness: 0.38,
        metalness: 0.55,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      }),
    []
  );

  const coreFacetGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Cranial plate
      -0.25, 0.98, 0.12,   -0.78, 0.65, 0.58,   0.35, 1.05, -0.45,
      -0.78, 0.65, 0.58,   -1.22, 0.05, 0.92,   0.05, 0.22, 0.18,
      -0.78, 0.65, 0.58,    0.05, 0.22, 0.18,  -0.25, 0.98, 0.12,
      // Shoulder & neck sculptural planes
      -0.25, 0.98, 0.12,    0.65, 1.25, -0.45,  0.42, 0.78, -0.15,
       0.65, 1.25, -0.45,   1.55, 1.15, -0.65,  1.38, 0.68, -0.38,
       0.42, 0.78, -0.15,   1.38, 0.68, -0.38,  0.95, 0.15, -0.12,
       1.38, 0.68, -0.38,   2.15, 0.12, -0.52,  1.75, -0.35, -0.32,
      // Snout & jaw plane
      -1.22, 0.05, 0.92,   -1.42, -0.55, 1.12, -0.68, -0.95, 0.68,
      -1.22, 0.05, 0.92,   -0.68, -0.95, 0.68,  0.05, 0.22, 0.18,
       0.05, 0.22, 0.18,   -0.68, -0.95, 0.68,  0.85, -1.42, -0.15,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpPt = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    return () => {
      traceEntries.forEach((t) => {
        t.geo.dispose();
        t.mat.dispose();
      });
      coreFacetGeo.dispose();
      coreFacetMat.dispose();
    };
  }, [traceEntries, coreFacetGeo, coreFacetMat]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (introStartRef.current < 0) introStartRef.current = elapsed;
    const tIntro = elapsed - introStartRef.current;

    // Draw each bull trace spline sequentially during intro
    traceEntries.forEach((entry) => {
      const localProgress = THREE.MathUtils.clamp(
        (tIntro - entry.spec.delay) / 0.85,
        0,
        1
      );
      const eased = 1 - Math.pow(1 - localProgress, 3);
      entry.geo.setDrawRange(0, Math.floor(entry.totalCount * eased));
    });

    // Subtle breathing float once resolved
    if (bullGroupRef.current) {
      bullGroupRef.current.position.y = 0.1 + Math.sin(elapsed * 0.65) * 0.08;
      bullGroupRef.current.rotation.y =
        -0.22 + Math.sin(elapsed * 0.35) * 0.05;
    }

    // Fade in core sculptural plates after traces begin resolving
    const facetAlpha = THREE.MathUtils.clamp((tIntro - 0.55) / 0.7, 0, 1);
    coreFacetMat.opacity = facetAlpha * 0.68;

    // Travelling market pulse nodes along the bull's trace splines
    if (pulseNodesRef.current) {
      for (let i = 0; i < traceEntries.length; i++) {
        const entry = traceEntries[i];
        const u = (elapsed * entry.spec.speed * 0.35 + i * 0.17) % 1;
        entry.curve.getPointAt(u, tmpPt);
        const visibleScale = tIntro > entry.spec.delay + 0.35 ? 1 : 0.001;
        dummy.position.copy(tmpPt);
        dummy.scale.setScalar(visibleScale);
        dummy.updateMatrix();
        pulseNodesRef.current.setMatrixAt(i, dummy.matrix);
      }
      pulseNodesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // Position bull on the right on desktop, centered & slightly scaled on mobile
  const groupPosition: [number, number, number] = isMobile
    ? [0.1, 0.25, -0.8]
    : [1.55, 0.1, -0.35];
  const groupScale = isMobile ? 0.72 : 1.02;

  return (
    <group
      ref={bullGroupRef}
      position={groupPosition}
      scale={groupScale}
      rotation={[0.04, -0.22, 0]}
    >
      <mesh geometry={coreFacetGeo} material={coreFacetMat} />

      {traceEntries.map((entry, idx) => (
        <primitive key={idx} object={entry.line} />
      ))}

      <instancedMesh
        ref={pulseNodesRef}
        args={[undefined, undefined, traceEntries.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.048, 10, 10]} />
        <meshStandardMaterial
          color="#A5EBC3"
          emissive="#36C982"
          emissiveIntensity={1.15}
          roughness={0.15}
        />
      </instancedMesh>
    </group>
  );
};

interface CandleSpec {
  x: number;
  y: number;
  z: number;
  bodyHeight: number;
  wickHeight: number;
  bullish: boolean;
  phase: number;
}

const FloatingCandlesticks: React.FC<{
  isMobile: boolean;
  introStartRef: React.MutableRefObject<number>;
}> = ({ isMobile, introStartRef }) => {
  const groupRef = useRef<THREE.Group>(null);

  const candles = useMemo<CandleSpec[]>(() => {
    const count = isMobile ? 8 : 14;
    const list: CandleSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = (isMobile ? -2.8 : -1.2) + t * (isMobile ? 5.6 : 6.4);
      const y = -1.15 + Math.sin(t * Math.PI * 1.6) * 0.75 + t * 0.65;
      const z = -2.2 + Math.cos(i * 1.9) * 1.35;
      const bullish = i % 3 !== 1;
      const bodyHeight = 0.42 + ((i * 7) % 8) * 0.1;
      const wickHeight = bodyHeight + 0.45 + ((i * 3) % 4) * 0.12;
      list.push({ x, y, z, bodyHeight, wickHeight, bullish, phase: i * 0.6 });
    }
    return list;
  }, [isMobile]);

  const bullBodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#36C982'),
        emissive: new THREE.Color('#214B37'),
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.35,
      }),
    []
  );

  const bearBodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#213228'),
        emissive: new THREE.Color('#141C17'),
        emissiveIntensity: 0.25,
        roughness: 0.5,
        metalness: 0.25,
      }),
    []
  );

  const wickMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#91A197'),
        roughness: 0.4,
        metalness: 0.7,
      }),
    []
  );

  const collarMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#A5EBC3'),
        roughness: 0.2,
        metalness: 0.8,
      }),
    []
  );

  useEffect(() => {
    return () => {
      bullBodyMat.dispose();
      bearBodyMat.dispose();
      wickMat.dispose();
      collarMat.dispose();
    };
  }, [bullBodyMat, bearBodyMat, wickMat, collarMat]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();
    const tIntro =
      introStartRef.current >= 0 ? elapsed - introStartRef.current : 0;
    const children = groupRef.current.children;

    for (let i = 0; i < children.length; i++) {
      const spec = candles[i];
      if (!spec) continue;
      const appear = THREE.MathUtils.clamp((tIntro - 0.35 - i * 0.03) / 0.45, 0, 1);
      const scaleY = 0.01 + appear * 0.99;
      children[i].scale.set(appear, scaleY, appear);
      children[i].position.y = spec.y + Math.sin(elapsed * 0.75 + spec.phase) * 0.14;
    }
  });

  return (
    <group ref={groupRef}>
      {candles.map((c, idx) => (
        <group key={idx} position={[c.x, c.y, c.z]}>
          <mesh material={c.bullish ? bullBodyMat : bearBodyMat}>
            <boxGeometry args={[0.24, c.bodyHeight, 0.24]} />
          </mesh>
          <mesh material={wickMat}>
            <cylinderGeometry args={[0.02, 0.02, c.wickHeight, 8]} />
          </mesh>
          <mesh position={[0, c.bodyHeight * 0.5 + 0.015, 0]} material={collarMat}>
            <boxGeometry args={[0.28, 0.028, 0.28]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const TranslucentPriceGrid: React.FC<{
  introStartRef: React.MutableRefObject<number>;
}> = ({ introStartRef }) => {
  const gridRef = useRef<THREE.GridHelper>(null);
  const verticalLinesGeo = useMemo(() => {
    const pts: number[] = [];
    for (let i = -4; i <= 5; i++) {
      const x = i * 1.4;
      pts.push(x, -2.05, -4.5, x, 2.8, -4.5);
    }
    for (let j = -1; j <= 3; j++) {
      const y = j * 1.1;
      pts.push(-6, y, -4.5, 7.5, y, -4.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const wallMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#36C982',
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useEffect(() => {
    return () => {
      verticalLinesGeo.dispose();
      wallMat.dispose();
    };
  }, [verticalLinesGeo, wallMat]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const tIntro =
      introStartRef.current >= 0 ? elapsed - introStartRef.current : 0;
    const progress = THREE.MathUtils.clamp(tIntro / 0.65, 0, 1);

    wallMat.opacity = progress * 0.1;
    if (gridRef.current) {
      const mat = gridRef.current.material as THREE.Material;
      if (mat && 'opacity' in mat) {
        mat.transparent = true;
        mat.opacity = progress * 0.45;
      }
    }
  });

  return (
    <group>
      <gridHelper
        ref={gridRef}
        args={[26, 32, '#36C982', '#1C2B22']}
        position={[0.8, -2.05, -0.8]}
      />
      <lineSegments geometry={verticalLinesGeo} material={wallMat} />
    </group>
  );
};

const EmeraldParticles: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = isMobile ? 55 : 130;

  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i * 1.6180339) % 1;
      const b = (i * 0.754877) % 1;
      const c = (i * 0.56984) % 1;
      positions[i * 3] = (a - 0.35) * 14;
      positions[i * 3 + 1] = (b - 0.35) * 6.5;
      positions[i * 3 + 2] = (c - 0.5) * 7 - 1;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  useEffect(() => {
    return () => {
      geo.dispose();
    };
  }, [geo]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        color="#A5EBC3"
        size={0.05}
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
};

const CameraRig: React.FC<{
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  isMobile: boolean;
}> = ({ pointerRef, isMobile }) => {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const ampX = isMobile ? 0.25 : 0.72;
    const ampY = isMobile ? 0.15 : 0.4;
    _vecTarget.set(
      pointerRef.current.x * ampX,
      0.55 + pointerRef.current.y * ampY,
      isMobile ? 8.8 : 7.6
    );
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _vecTarget.x, 3.0, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _vecTarget.y, 3.0, dt);
    camera.lookAt(isMobile ? 0 : 0.7, 0.25, -0.4);
  });

  return null;
};

const HeroScene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const introStartRef = useRef(-1);
  const [inView, setInView] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Pause rendering when hero leaves viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    >
      <Canvas
        frameloop={inView ? 'always' : 'demand'}
        dpr={isSoftwareGl || isMobile ? 1 : [1, 1.75]}
        camera={{ position: [0, 0.55, 7.6], fov: 44, near: 0.1, far: 50 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          alpha: true,
        }}
      >
        <color attach="background" args={['#101512']} />
        <fog attach="fog" args={['#101512', 6.5, 18]} />

        <hemisphereLight args={['#A5EBC3', '#0D1410', 0.55]} />
        <directionalLight position={[5, 7, 5]} intensity={1.45} color="#E8F0EA" />
        <directionalLight position={[-4, 3, 2]} intensity={0.85} color="#36C982" />
        <directionalLight position={[2, -3, -4]} intensity={0.45} color="#214B37" />

        <TranslucentPriceGrid introStartRef={introStartRef} />
        <SculpturalBullGroup isMobile={isMobile} introStartRef={introStartRef} />
        <FloatingCandlesticks isMobile={isMobile} introStartRef={introStartRef} />
        <EmeraldParticles isMobile={isMobile} />
        <CameraRig pointerRef={pointerRef} isMobile={isMobile} />
      </Canvas>
    </div>
  );
};

export default HeroScene3D;
