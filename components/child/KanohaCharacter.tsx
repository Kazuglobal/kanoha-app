"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./KanohaCharacter.module.css";
import {
  DEFAULT_EQUIPPED,
  DEFAULT_CHARACTER_ID,
  getEquippedAccessories,
  getSelectedCharacter,
  type EquippedAccessories,
  type AccessoryCategory,
  type CharacterId,
} from "@/lib/rewards/characterGrowthStore";
import {
  RibbonBow,
  StarHairPin,
  StarHairPinBadge,
  HeartEarring,
  HeartEarringPair,
  MagicWand,
  BearPochette,
  AngelWings,
  HairstyleExtension,
  CHARACTER_ANCHORS,
  TRIMMED_ITEM_SPRITES,
  TRIMMED_HAIR_SPRITES,
  HAIR_COLOR_FILTERS,
  CHAR_NATIVE_HAIR_FILTER,
  NaturalGlassesOverlay,
  NaturalShoeStyleBadge,
} from "./CharacterAccessories";

type Mood = "happy" | "think" | "celebrate";

interface KanohaCharacterProps {
  mood?: Mood;
  accessories?: EquippedAccessories;
  characterId?: CharacterId;
  previewCategory?: AccessoryCategory;
  onClick?: () => void;
}

const SPRITES = {
  happy: "/images/character/kanoha-ref-happy.png",
  think: "/images/character/kanoha-ref-think.png",
  celebrate: "/images/character/kanoha-ref-celebrate.png",
  school: "/images/character/kanoha-ref-school.png",
  hoodie: "/images/character/kanoha-ref-hoodie.png",
  safari: "/images/character/kanoha-ref-safari.png",
  wizard: "/images/character/kanoha-ref-wizard.png",
  hero: "/images/character/kanoha-ref-hero.png",
  glassesRound: "/images/character/kanoha-ref-glasses-round.png",
  glassesStar: "/images/character/kanoha-ref-glasses-star.png",
  beret: "/images/character/kanoha-ref-beret.png",
  mittens: "/images/character/kanoha-ref-mittens.png",
  glovesGold: "/images/character/kanoha-ref-gloves-gold.png",
} as const;

// 手袋領域のみを厳密に切り出し（上端 y=0% の透明領域を経由し、両手首のもこもこボアカフスを100%保持しつつ茶髪の毛先や胴体を除外）
const GLOVES_CLIP =
  "polygon(18% 0%, 18% 36%, 32% 36%, 35% 39.5%, 41.5% 39.8%, 41.5% 49%, 33% 50.5%, 18% 50.5%, 18% 0%, 69.5% 0%, 69.5% 56%, 89.5% 56%, 89.5% 68%, 69.5% 68%, 69.5% 0%)";

// 膝下の靴下・靴・ブーツ領域（左足のふくらはぎを斜めに避けつつ元の靴を100%差し替える）
const SHOE_REGION_CLIP =
  "polygon(24% 79.5%, 35% 78%, 49.5% 82.5%, 49.5% 85.5%, 76% 85.5%, 76% 100%, 24% 100%)";

// 靴カラー変更時は白い靴下や素足の肌を変色させず、靴本体のみを着色するポリゴン
const SHOE_LEATHER_CLIP =
  "polygon(25% 81%, 35.5% 81%, 45.5% 85.5%, 45.5% 98%, 25% 98%, 25% 81%, 48.5% 88.5%, 65.5% 88%, 73% 99.5%, 48.5% 99.5%, 48.5% 88.5%)";

const SHOES_COLOR_FILTERS: Record<string, string> = {
  shoes_color_pink: "none",
  shoes_color_white: "brightness(2.4) contrast(0.9) saturate(0.1)",
  shoes_color_brown: "sepia(0.95) hue-rotate(-25deg) brightness(0.65) contrast(1.2)",
  shoes_color_blue: "hue-rotate(185deg) saturate(2.8) brightness(1.15)",
  shoes_color_gold: "hue-rotate(25deg) saturate(4) brightness(1.3)",
};

const NEW_CHAR_SHOE_STYLE_FILTERS: Record<string, string> = {
  shoes_sneaker: "none",
  shoes_boots: "sepia(0.85) hue-rotate(-20deg) brightness(0.78) contrast(1.15)",
  shoes_pumps: "sepia(0.6) hue-rotate(310deg) saturate(2.6) brightness(1.05)",
  shoes_magical: "sepia(0.65) hue-rotate(240deg) saturate(2.5) brightness(1.12)",
  shoes_hero: "sepia(0.85) hue-rotate(15deg) saturate(3.2) brightness(1.2)",
};

const SHOES_SPRITES: Record<string, string> = {
  shoes_sneaker: SPRITES.happy,
  shoes_boots: SPRITES.safari,
  shoes_pumps: SPRITES.school,
  shoes_magical: SPRITES.wizard,
  shoes_hero: SPRITES.hero,
};

const NATIVE_OUTFIT_SHOES: Record<string, string> = {
  clothes_casual: "shoes_sneaker",
  clothes_tshirt: "shoes_sneaker",
  clothes_hoodie: "shoes_sneaker",
  clothes_school: "shoes_pumps",
  clothes_safari: "shoes_boots",
  clothes_wizard: "shoes_magical",
  clothes_hero: "shoes_hero",
};

function buildBaseClipPath({
  clipTopHead,
  clipGloves,
  clipLeftHand,
  clipShoes,
}: {
  clipTopHead: boolean;
  clipGloves: boolean;
  clipLeftHand?: boolean;
  clipShoes: boolean;
}): string | undefined {
  if (!clipTopHead && !clipGloves && !clipLeftHand && !clipShoes) {
    return undefined;
  }

  const points: string[] = [];

  // 1. 上辺 (x: 0% -> 100%, 元の頭頂部おだんご・ピンクリボン・耳下の茶髪サイドカール先端まで完全にクリップ除去)
  if (clipTopHead) {
    points.push(
      "0% 0%",
      "14% 0%",
      "14% 36.5%",
      "34% 36.5%",
      "41.2% 39.0%",
      "41.2% 35.6%",
      "38% 35.2%",
      "38% 33.8%",
      "33.5% 33.5%",
      "31.5% 28%",
      "31.5% 22%",
      "35% 20.5%",
      "38% 17.5%",
      "44% 15.5%",
      "58% 15.5%",
      "65% 17.5%",
      "67.5% 23%",
      "68% 28%",
      "70.5% 29%",
      "70.5% 32.5%",
      "66.5% 33.8%",
      "66.5% 38.5%",
      "98% 38.5%",
      "98% 0%",
      "100% 0%",
    );
  } else {
    points.push("0% 0%", "100% 0%");
  }

  // 2. 右辺 (y: 0% -> 100%, 手袋着用時は右側の素手 y:56%..68% を切り抜く)
  if (clipGloves) {
    points.push(
      "100% 56%",
      "69.5% 56%",
      "69.5% 68%",
      "100% 68%",
      "100% 100%",
    );
  } else {
    points.push("100% 100%");
  }

  // 3. 下辺 (x: 100% -> 0%, 靴オーバーレイ時は元の靴をふくらはぎに沿って切り抜く)
  if (clipShoes) {
    points.push(
      "76% 100%",
      "76% 85.5%",
      "49.5% 85.5%",
      "49.5% 82.5%",
      "35% 78%",
      "24% 79.5%",
      "24% 100%",
      "0% 100%",
    );
  } else {
    points.push("0% 100%");
  }

  // 4. 左辺 (y: 100% -> 0%, 手袋または魔法のステッキ着用時は左側の素手を切り抜く)
  if (clipGloves || clipLeftHand) {
    points.push(
      "0% 50.5%",
      "33% 50.5%",
      "41.5% 49%",
      "41.5% 39.8%",
      "35% 39.5%",
      "32% 36%",
      "0% 36%",
    );
  }

  return `polygon(${points.join(", ")})`;
}

export function getKanohaSprite(
  mood: Mood,
  accessories: EquippedAccessories,
  _previewCategory?: AccessoryCategory,
): string {
  const charId = accessories.character;
  if (charId && charId !== "char_sayuki") {
    const charKey = CHARACTER_ANCHORS[charId]?.key ?? "luna";
    switch (accessories.clothes) {
      case "clothes_school":
        return `/images/character/char-${charKey}-school.png`;
      case "clothes_safari":
        return `/images/character/char-${charKey}-safari.png`;
      case "clothes_hoodie":
        return `/images/character/char-${charKey}-hoodie.png`;
      case "clothes_wizard":
        return `/images/character/char-${charKey}-wizard.png`;
      case "clothes_hero":
        return `/images/character/char-${charKey}-hero.png`;
      default:
        return `/images/character/char-${charKey}-happy.png`;
    }
  }

  switch (accessories.clothes) {
    case "clothes_school":
      return SPRITES.school;
    case "clothes_safari":
      return SPRITES.safari;
    case "clothes_hoodie":
      return SPRITES.hoodie;
    case "clothes_wizard":
      return SPRITES.wizard;
    case "clothes_hero":
      return SPRITES.hero;
    default:
      return SPRITES[mood];
  }
}

export function KanohaCharacter({
  mood = "happy",
  accessories,
  characterId,
  onClick,
}: KanohaCharacterProps) {
  const [storedAccessories, setStoredAccessories] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);
  const [storedCharacter, setStoredCharacter] = useState<CharacterId>(DEFAULT_CHARACTER_ID);

  useEffect(() => {
    setStoredAccessories(getEquippedAccessories());
    setStoredCharacter(getSelectedCharacter());
    const update = () => {
      setStoredAccessories(getEquippedAccessories());
      setStoredCharacter(getSelectedCharacter());
    };
    window.addEventListener("kanoha-accessory-update", update);
    window.addEventListener("kanoha-character-update", update);
    return () => {
      window.removeEventListener("kanoha-accessory-update", update);
      window.removeEventListener("kanoha-character-update", update);
    };
  }, []);

  const activeAccessories = accessories ?? storedAccessories;
  const resolvedCharacterId: CharacterId =
    characterId ??
    activeAccessories.character ??
    (accessories ? "char_sayuki" : storedCharacter);

  // 新5キャラクター（ルナ・コハル・ノア・リーフ・ピコ）の3Dレンダリングパイプライン
  if (resolvedCharacterId !== "char_sayuki") {
    const anchors = CHARACTER_ANCHORS[resolvedCharacterId] ?? CHARACTER_ANCHORS.char_luna;
    const charKey = anchors.key;
    const baseSrc = getKanohaSprite(mood, {
      ...activeAccessories,
      character: resolvedCharacterId,
    });

    const hairStyle = activeAccessories.hairstyle ?? "hair_bun";
    const hairColor = activeAccessories.hair_color ?? "hair_color_brown";
    const hairFilter = HAIR_COLOR_FILTERS[hairColor] ?? "none";
    const extHairFilter =
      hairColor === "hair_color_brown"
        ? CHAR_NATIVE_HAIR_FILTER[resolvedCharacterId]
        : hairFilter;

    const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
    const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
    const shoesColorFilter =
      shoesColor !== "shoes_color_pink"
        ? (SHOES_COLOR_FILTERS[shoesColor] ?? "none")
        : (NEW_CHAR_SHOE_STYLE_FILTERS[shoesType] ?? "none");

    const glovesType = activeAccessories.gloves ?? "gloves_none";
    const glassesType = activeAccessories.glasses ?? "glasses_none";
    const hatType = activeAccessories.hat ?? "hat_none";
    const accessoryType = activeAccessories.accessory ?? "acc_none";

    let hatSpriteSrc: string | null = null;
    if (hatType === "hat_beret") hatSpriteSrc = TRIMMED_ITEM_SPRITES.hatBeret;
    else if (hatType === "hat_safari") hatSpriteSrc = TRIMMED_ITEM_SPRITES.hatSafari;
    else if (hatType === "hat_wizard") hatSpriteSrc = TRIMMED_ITEM_SPRITES.hatWizard;
    else if (hatType === "hat_crown") hatSpriteSrc = TRIMMED_ITEM_SPRITES.hatCrown;

    const moodLabel =
      mood === "think" ? "かんがえちゅう" : mood === "celebrate" ? "よろこび" : "にっこり";

    return (
      <div
        className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
        role={onClick ? "button" : "img"}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${anchors.label}（${moodLabel}）`}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className={styles.characterContainer}>
          {/* レイヤー0: 天使の翼 (背中アクセサリ) */}
          {accessoryType === "acc_wings" && (
            <Image
              key="new-char-wings"
              src={TRIMMED_ITEM_SPRITES.wings}
              width={716}
              height={467}
              alt=""
              draggable={false}
              unoptimized
              style={{
                position: "absolute",
                top: anchors.wings.top,
                left: anchors.wings.left,
                width: anchors.wings.width,
                height: "auto",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

          {/* レイヤー0b: 髪型エクステンション（おだんご以外の髪型を選択時、キャラの頭部にフィット） */}
          {hairStyle !== "hair_bun" && (
            <Image
              key={`new-char-hair-ext-${hairStyle}-${hairColor}`}
              src={TRIMMED_HAIR_SPRITES[hairStyle] ?? TRIMMED_HAIR_SPRITES.hair_bob}
              width={500}
              height={600}
              alt=""
              draggable={false}
              unoptimized
              style={{
                position: "absolute",
                top: anchors.hairExt.top,
                left: anchors.hairExt.left,
                width: anchors.hairExt.width,
                height: "auto",
                transform: `translate(-50%, -48%) rotate(${anchors.hairExt.rotate}deg)`,
                filter: extHairFilter !== "none" ? extHairFilter : undefined,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

          {/* レイヤー1: ベース全身3D衣装 */}
          <Image
            key={`base-${baseSrc}`}
            className={styles.sprite}
            src={baseSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ position: "relative", zIndex: 2 }}
          />

          {/* レイヤー2: 髪色変更マスクレイヤー */}
          {hairFilter !== "none" && (
            <Image
              key={`hair-mask-${charKey}-${hairColor}`}
              className={styles.overlaySprite}
              src={`/images/character/char-${charKey}-hair.png`}
              width={1024}
              height={1536}
              alt=""
              draggable={false}
              unoptimized
              style={{
                filter: hairFilter,
                zIndex: 3,
              }}
            />
          )}

          {/* レイヤー3: 靴色・靴スタイル変更マスク＆3Dバッジ */}
          {shoesColorFilter !== "none" && (
            <Image
              key={`shoes-mask-${charKey}-${shoesType}-${shoesColor}`}
              className={styles.shoesOverlay}
              src={`/images/character/char-${charKey}-shoes.png`}
              width={1024}
              height={1536}
              alt=""
              draggable={false}
              unoptimized
              style={{
                filter: shoesColorFilter,
                zIndex: 3,
              }}
            />
          )}
          <NaturalShoeStyleBadge
            shoesType={shoesType}
            leftShoe={anchors.shoeLeft}
            rightShoe={anchors.shoeRight}
          />

          {/* レイヤー4: 手袋レイヤー（ゴールドグローブまたはふわもこミトン） */}
          {glovesType === "gloves_gold" && (
            <Image
              key={`gloves-gold-${charKey}`}
              className={styles.glovesOverlay}
              src={`/images/character/char-${charKey}-hands.png`}
              width={1024}
              height={1536}
              alt=""
              draggable={false}
              unoptimized
              style={{ zIndex: 4 }}
            />
          )}
          {glovesType === "gloves_mitten" && (
            <>
              <Image
                key={`gloves-mitten-left-${charKey}`}
                src={TRIMMED_ITEM_SPRITES.glovesMitten}
                width={154}
                height={189}
                alt=""
                draggable={false}
                unoptimized
                style={{
                  position: "absolute",
                  top: anchors.handLeft.top,
                  left: anchors.handLeft.left,
                  width: anchors.handLeft.size,
                  height: "auto",
                  transform: `translate(-50%, -50%) rotate(${anchors.handLeft.rotate}deg)`,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
              <Image
                key={`gloves-mitten-right-${charKey}`}
                src={TRIMMED_ITEM_SPRITES.glovesMitten}
                width={154}
                height={189}
                alt=""
                draggable={false}
                unoptimized
                style={{
                  position: "absolute",
                  top: anchors.handRight.top,
                  left: anchors.handRight.left,
                  width: anchors.handRight.size,
                  height: "auto",
                  transform: `translate(-50%, -50%) scaleX(-1) rotate(${-anchors.handRight.rotate}deg)`,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
            </>
          )}

          {/* レイヤー5: メガネレイヤー */}
          {(glassesType === "glasses_round" || glassesType === "glasses_star") && (
            <NaturalGlassesOverlay type={glassesType} anchor={anchors.glasses} />
          )}

          {/* レイヤー6: 帽子・リボンレイヤー */}
          {hatSpriteSrc && (
            <Image
              key={`hat-${charKey}-${hatType}`}
              src={hatSpriteSrc}
              width={500}
              height={400}
              alt=""
              draggable={false}
              unoptimized
              style={{
                position: "absolute",
                top: hatType === "hat_crown" ? anchors.crown.top : anchors.hat.top,
                left: hatType === "hat_crown" ? anchors.crown.left : anchors.hat.left,
                width:
                  hatType === "hat_crown"
                    ? anchors.crown.width
                    : hatType === "hat_wizard"
                      ? `calc(${anchors.hat.width} * 1.24)`
                      : anchors.hat.width,
                height: "auto",
                transform: `translate(-50%, -55%) rotate(${
                  hatType === "hat_crown" ? anchors.crown.rotate : anchors.hat.rotate
                }deg)`,
                pointerEvents: "none",
                zIndex: 8,
              }}
            />
          )}
          {hatType === "hat_ribbon" && (
            <div
              className={styles.accessoryLayer}
              style={{
                top: anchors.crown.top,
                left: anchors.crown.left,
                transform: `translate(-50%, -50%) rotate(${anchors.crown.rotate}deg)`,
                zIndex: 8,
              }}
              aria-hidden="true"
            >
              <RibbonBow />
            </div>
          )}

          {/* レイヤー7: アクセサリー（ヘアピン・イヤリング・ステッキ・くまポシェット） */}
          {accessoryType === "acc_pin_star" && (
            <div
              style={{
                position: "absolute",
                top: anchors.pin.top,
                left: anchors.pin.left,
                transform: `translate(-50%, -50%) rotate(${anchors.pin.rotate}deg)`,
                pointerEvents: "none",
                zIndex: 9,
              }}
              aria-hidden="true"
            >
              <StarHairPinBadge />
            </div>
          )}
          {accessoryType === "acc_heart_earring" && (
            <HeartEarringPair leftEar={anchors.earLeft} rightEar={anchors.earRight} />
          )}
          {accessoryType === "acc_wand" && (
            <Image
              key={`wand-${charKey}`}
              src={TRIMMED_ITEM_SPRITES.wand}
              width={259}
              height={325}
              alt=""
              draggable={false}
              unoptimized
              style={{
                position: "absolute",
                top: anchors.wand.top,
                left: anchors.wand.left,
                width: anchors.wand.width,
                height: "auto",
                transform: `translate(-50%, -50%) rotate(${anchors.wand.rotate}deg)`,
                pointerEvents: "none",
                zIndex: 9,
              }}
            />
          )}
          {accessoryType === "acc_bag_bear" && (
            <Image
              key={`bag-${charKey}`}
              src={TRIMMED_ITEM_SPRITES.bagBear}
              width={235}
              height={328}
              alt=""
              draggable={false}
              unoptimized
              style={{
                position: "absolute",
                top: anchors.bag.top,
                left: anchors.bag.left,
                width: anchors.bag.width,
                height: "auto",
                transform: `translate(-50%, -50%) rotate(${anchors.bag.rotate}deg)`,
                pointerEvents: "none",
                zIndex: 6,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // 1. ベース衣装 (さゆきちゃん用レガシーパイプライン)
  const baseSrc = getKanohaSprite(mood, activeAccessories);
  const currentClothes = activeAccessories.clothes ?? "clothes_casual";

  // 2. メガネレイヤー
  let glassesSrc: string | null = null;
  if (activeAccessories.glasses === "glasses_round") {
    glassesSrc = SPRITES.glassesRound;
  } else if (activeAccessories.glasses === "glasses_star") {
    glassesSrc = SPRITES.glassesStar;
  }

  // 3. 手袋レイヤー
  let glovesSrc: string | null = null;
  if (activeAccessories.gloves === "gloves_mitten") {
    glovesSrc = SPRITES.mittens;
  } else if (activeAccessories.gloves === "gloves_gold") {
    glovesSrc = SPRITES.glovesGold;
  }

  // 4. 髪型・髪色レイヤー (Hairstyle & Hair Color)
  const hairStyle = activeAccessories.hairstyle ?? "hair_bun";
  const hairColor = activeAccessories.hair_color ?? "hair_color_brown";

  // 5. 帽子レイヤー (Hat)
  const hatType = activeAccessories.hat ?? "hat_none";

  let hatSrc: string | null = null;
  let hatClip = "polygon(20% 0%, 82% 0%, 82% 23.5%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 34% 20.5%, 20% 23.5%)";
  if (hatType === "hat_beret") {
    hatSrc = SPRITES.beret;
  } else if (hatType === "hat_safari") {
    hatSrc = SPRITES.safari;
    hatClip = "polygon(18% 0%, 84% 0%, 84% 24%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 34% 20.5%, 18% 24%)";
  } else if (hatType === "hat_wizard") {
    hatSrc = SPRITES.wizard;
    hatClip =
      "polygon(14% 0%, 98% 0%, 98% 35%, 71% 35%, 71% 22.5%, 68.5% 21%, 65% 17.5%, 38% 17.5%, 35% 20.5%, 31.5% 22%, 31.5% 35%, 14% 35%)";
  } else if (hatType === "hat_crown") {
    hatSrc = SPRITES.hero;
    hatClip = "polygon(38% 4.5%, 63% 4.5%, 60% 13.5%, 41% 13.5%)";
  }

  // ベーススプライトに描き込まれた元のおだんご・ピンクリボン・内蔵帽子・サイドカールは常にクリップ除去し、
  // 選択中の3D髪型(HairstyleExtension)と選択中の帽子・アクセサリのみをクリーンに描画する
  const clipTopHead = true;

  const hatCoversBun =
    hatType === "hat_beret" || hatType === "hat_safari" || hatType === "hat_wizard";
  const showCleanBun = hairStyle === "hair_bun" && !hatCoversBun;

  // 6. 靴レイヤー (Shoes & Shoes Color)
  const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
  const shoesColor = activeAccessories.shoes_color ?? "shoes_color_pink";
  const shoesBaseSrc = SHOES_SPRITES[shoesType] ?? SPRITES.happy;
  const shoesFilter = SHOES_COLOR_FILTERS[shoesColor] ?? "none";

  const hasExplicitShoes = Boolean(activeAccessories.shoes || activeAccessories.shoes_color);
  const isNativeShoeUncolored =
    shoesType === (NATIVE_OUTFIT_SHOES[currentClothes] ?? "shoes_sneaker") &&
    shoesColor === "shoes_color_pink";
  const showShoesOverlay = hasExplicitShoes && !isNativeShoeUncolored;

  // 7. アクセサリー (Accessory)
  const accessoryType = activeAccessories.accessory ?? "acc_none";

  // ベーススプライトの複合クリップパス（元の髪型・元の帽子・元の素手・元の靴を完全に除去）
  const baseClipPath = buildBaseClipPath({
    clipTopHead,
    clipGloves: Boolean(glovesSrc),
    clipLeftHand: accessoryType === "acc_wand",
    clipShoes: showShoesOverlay,
  });

  return (
    <div
      className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`さゆきちゃん（${mood === "think" ? "かんがえちゅう" : mood === "celebrate" ? "よろこび" : "にっこり"}）`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className={styles.characterContainer}>
        {/* レイヤー0: 天使の翼 (背中アクセサリ) */}
        {accessoryType === "acc_wings" && <AngelWings />}

        {/* レイヤー0b: 3D髪型 背面レイヤー（肩・襟元・腕の後ろに自然に回り込む髪） */}
        <HairstyleExtension
          hairstyle={hairStyle}
          hairColor={hairColor}
          showCleanBun={showCleanBun}
          layer="back"
        />

        {/* レイヤー1: ベース全身衣装（元の靴・素手・頭頂部おだんご/帽子を必要に応じてクリップ除去） */}
        <Image
          key={`base-${baseSrc}`}
          className={styles.sprite}
          src={baseSrc}
          width={1024}
          height={1536}
          alt=""
          draggable={false}
          unoptimized
          style={baseClipPath ? { clipPath: baseClipPath } : undefined}
        />

        {/* レイヤー1c: 3D髪型 前面レイヤー（頭頂部・前髪・顔周りのサイド髪） */}
        <HairstyleExtension
          hairstyle={hairStyle}
          hairColor={hairColor}
          showCleanBun={showCleanBun}
          layer="front"
        />

        {/* レイヤー1e: 靴＆靴色オーバーレイ (元の靴をクリップ除去した上に100%不透明で描画し、色変更時は靴本体のみ着色) */}
        {showShoesOverlay && (
          <>
            <Image
              key={`shoes-${shoesType}-${shoesColor}`}
              className={styles.shoesOverlay}
              src={shoesBaseSrc}
              width={1024}
              height={1536}
              alt=""
              draggable={false}
              unoptimized
              style={{
                clipPath: SHOE_REGION_CLIP,
              }}
            />
            {shoesFilter !== "none" && (
              <svg
                viewBox="0 0 1024 1536"
                className={styles.shoesOverlay}
                style={{ pointerEvents: "none" }}
                aria-hidden="true"
              >
                <image
                  href={shoesBaseSrc}
                  width="1024"
                  height="1536"
                  style={{
                    clipPath: SHOE_LEATHER_CLIP,
                    filter: shoesFilter,
                  }}
                />
              </svg>
            )}
          </>
        )}

        {/* レイヤー2: 手袋オーバーレイ (元の素手をクリップ除去した上に両手領域のみを描画) */}
        {glovesSrc && (
          <Image
            key={`gloves-${glovesSrc}`}
            className={styles.glovesOverlay}
            src={glovesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{
              clipPath: GLOVES_CLIP,
            }}
          />
        )}

        {/* レイヤー3: メガネオーバーレイ (目元ソフトマスク) */}
        {glassesSrc && (
          <Image
            key={`glasses-${glassesSrc}`}
            className={styles.glassesOverlay}
            src={glassesSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: "polygon(34% 21%, 73% 21%, 73% 34.5%, 34% 34.5%)" }}
          />
        )}

        {/* レイヤー4: 帽子オーバーレイ */}
        {hatSrc && (
          <Image
            key={`hat-${hatSrc}`}
            className={styles.overlaySprite}
            src={hatSrc}
            width={1024}
            height={1536}
            alt=""
            draggable={false}
            unoptimized
            style={{ clipPath: hatClip, zIndex: 6 }}
          />
        )}

        {/* ピンクのサテンリボン装飾 */}
        {hatType === "hat_ribbon" && (
          <div
            className={styles.accessoryLayer}
            style={{ top: "8%", left: "50%", transform: "translate(-50%, -50%)" }}
            aria-hidden="true"
          >
            <RibbonBow />
          </div>
        )}

        {/* レイヤー5: 3D生成アクセサリー */}
        {accessoryType === "acc_pin_star" && <StarHairPin />}
        {accessoryType === "acc_heart_earring" && <HeartEarring />}
        {accessoryType === "acc_wand" && <MagicWand />}
        {accessoryType === "acc_bag_bear" && <BearPochette />}
      </div>
    </div>
  );
}
