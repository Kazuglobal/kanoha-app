import { useId } from "react";
import styles from "./KanohaCharacter.module.css";
import { effectSpec, isOnFace, petIcon, type EffectSpec, type Intensity, type MotionName } from "./characterExtrasData";

const PARTICLE_CLASS = {
  twinkle: styles.particleTwinkle,
  rise: styles.particleRise,
  fall: styles.particleFall,
} as const;

const RAINBOW = ["#ff5a5a", "#ff9f43", "#ffd93d", "#4cd964", "#4dabf7", "#6c5ce7", "#e056fd"];

const MOTION_CLASS: Record<MotionName, string> = {
  calm: "", // 基本の ふわふわ(.characterContainer の float)のまま
  bouncy: styles.motionBouncy,
  float: styles.motionFloat,
  sway: styles.motionSway,
  dance: styles.motionDance,
  spin: styles.motionSpin,
};

/** キャラクター全体のうごき(待機中)の CSS クラス。 */
export const motionClassName = (motion: MotionName): string => MOTION_CLASS[motion];

function Particles({ spec, intensity }: { spec: EffectSpec; intensity: Intensity }) {
  const shown = intensity === "subtle" ? spec.particles.slice(0, Math.ceil(spec.particles.length / 2)) : spec.particles;
  return (
    <>
      {shown.map((p, i) => (
        <g
          key={i}
          className={spec.motion === "twinkle" ? undefined : styles.particleSway}
          style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.duration * 1.6}s` }}
        >
          {spec.shape === "bubble" ? (
            <circle
              className={`${PARTICLE_CLASS[spec.motion]} ${isOnFace(p.x, p.y) ? styles.particleFace : ""}`}
              cx={p.x}
              cy={p.y}
              r={p.size * 0.55}
              fill="rgba(190, 228, 255, 0.3)"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth={5}
              style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
            />
          ) : (
            <text
              className={`${PARTICLE_CLASS[spec.motion]} ${isOnFace(p.x, p.y) ? styles.particleFace : ""}`}
              x={p.x}
              y={p.y}
              fontSize={p.size}
              textAnchor="middle"
              style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
            >
              {spec.glyph}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

function RainbowOrbit() {
  return (
    <g className={styles.orbit}>
      {RAINBOW.map((color, i) => {
        const angle = (i / RAINBOW.length) * Math.PI * 2;
        const x = 512 + 430 * Math.cos(angle);
        const y = 760 + 430 * Math.sin(angle);
        return <circle key={color} className={isOnFace(x, y) ? styles.particleFace : undefined} cx={x} cy={y} r={34} fill={color} opacity={0.9} />;
      })}
    </g>
  );
}

function AuraGlow({ gradientId }: { gradientId: string }) {
  return (
    <>
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor="#ffd84a" stopOpacity="0" />
          <stop offset="68%" stopColor="#ffd84a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffb300" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className={styles.auraPulse} cx={512} cy={800} rx={440} ry={700} fill={`url(#${gradientId})`} />
    </>
  );
}

function EffectLayer({ spec, intensity }: { spec: EffectSpec; intensity: Intensity }) {
  const gradientId = `${useId().replace(/:/g, "")}-aura`;
  return (
    <svg viewBox="0 0 1024 1536" className={styles.effectLayer} data-effect={spec.name} data-intensity={intensity} aria-hidden="true">
      {spec.shape === "aura" && <AuraGlow gradientId={gradientId} />}
      {spec.shape === "orbit" && <RainbowOrbit />}
      {(spec.shape === "glyph" || spec.shape === "bubble") && <Particles spec={spec} intensity={intensity} />}
    </svg>
  );
}

function Pet({ id, icon }: { id: string; icon: string }) {
  return (
    <svg viewBox="0 0 100 100" className={styles.pet} data-pet={id} aria-hidden="true">
      <ellipse cx={50} cy={93} rx={26} ry={5} fill="rgba(60, 40, 60, 0.14)" />
      <text className={styles.petHop} x={50} y={80} fontSize={78} textAnchor="middle">
        {icon}
      </text>
    </svg>
  );
}

interface CharacterExtrasProps {
  effect: string | undefined;
  pet: string | undefined;
  intensity: Intensity;
}

/**
 * キャラクターのまわりに出す、エフェクト(光や粒)とペット。キャラクターの絵とは別の層で、
 * キャラクターのうごきには引きずられない。飾りなので読み上げず、タップも通す。
 */
export function CharacterExtras({ effect, pet, intensity }: CharacterExtrasProps) {
  const spec = effectSpec(effect);
  const icon = petIcon(pet);
  if (!spec && !icon) return null;
  return (
    <div className={styles.extras} aria-hidden="true">
      <div className={styles.extrasBox}>
        {spec && <EffectLayer spec={spec} intensity={intensity} />}
        {icon && pet && <Pet id={pet} icon={icon} />}
      </div>
    </div>
  );
}
