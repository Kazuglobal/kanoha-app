"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./KanohaCharacter.module.css";
import {
  CHARACTER_DEFAULT_HAIRSTYLES,
  DEFAULT_EQUIPPED,
  getEquippedAccessories,
  type CharacterId,
  type EquippedAccessories,
  type AccessoryCategory,
} from "@/lib/rewards/characterGrowthStore";
import {
  RibbonBow,
  StarHairPin,
  HeartEarring,
  MagicWand,
  BearPochette,
  AngelWings,
  HairstyleExtension,
  NewCharacterHairstyleOverlay,
  NewCharacterGlassesOverlay,
  NewCharacterGlovesOverlay,
  resolveCharacterHairFilter,
} from "./CharacterAccessories";
import {
  CHARACTER_ANCHORS,
  CHARACTER_DISPLAY_NAMES,
  GLOVES_CLIP,
  NATIVE_OUTFIT_SHOES,
  NATIVE_VARIANT_SHOES,
  NEW_CHARACTER_SPRITES,
  NEW_CHAR_HAT_TO_VARIANT,
  NEW_CHAR_SHOES_TO_VARIANT,
  SHOES_COLOR_FILTERS,
  SHOES_SPRITES,
  SHOE_LEATHER_CLIP,
  SHOE_REGION_CLIP,
  SPRITES,
  buildBaseClipPath,
  getKanohaSprite,
  resolveNewCharacterVariant,
  type Mood,
  type OutfitVariant,
} from "./kanohaCharacterSprites";

export { CHARACTER_DISPLAY_NAMES, getKanohaSprite } from "./kanohaCharacterSprites";

interface KanohaCharacterProps {
  mood?: Mood;
  accessories?: EquippedAccessories;
  previewCategory?: AccessoryCategory;
  onClick?: () => void;
}

export function KanohaCharacter({ mood = "happy", accessories, previewCategory, onClick }: KanohaCharacterProps) {
  const [storedAccessories, setStoredAccessories] = useState<EquippedAccessories>(DEFAULT_EQUIPPED);

  useEffect(() => {
    setStoredAccessories(getEquippedAccessories());
    const update = () => {
      setStoredAccessories(getEquippedAccessories());
    };
    window.addEventListener("kanoha-accessory-update", update);
    return () => window.removeEventListener("kanoha-accessory-update", update);
  }, []);

  const activeAccessories = accessories ?? storedAccessories;
  const charId = ((activeAccessories.character ?? "char_kanoha") in CHARACTER_DISPLAY_NAMES
    ? (activeAccessories.character ?? "char_kanoha")
    : "char_kanoha") as CharacterId;
  const displayName = CHARACTER_DISPLAY_NAMES[charId];
  const moodLabel = mood === "think" ? "かんがえちゅう" : mood === "celebrate" ? "よろこび" : "にっこり";

  // 新規5キャラクター選択時は、各キャラクター専用の3D生成フルボディスプライト・髪型・帽子・メガネ・手袋・靴・髪色・アクセサリを独立合成
  if (charId !== "char_kanoha") {
    const variant = resolveNewCharacterVariant(activeAccessories, previewCategory);
    const charSrc = NEW_CHARACTER_SPRITES[charId][variant];
    const hairSrc = charSrc.replace(/\.png$/, "-hair.png");
    const anchor = CHARACTER_ANCHORS[charId];

    // 1. 髪型 & 髪色
    const defaultHairstyle = CHARACTER_DEFAULT_HAIRSTYLES[charId] ?? "hair_fluffy";
    const hairStyle = activeAccessories.hairstyle ?? defaultHairstyle;
    const hairColor = activeAccessories.hair_color;
    const hairFilter = resolveCharacterHairFilter(charId, hairColor);

    // 2. 帽子 (hat_none の時は衣装内蔵の帽子を消し、選択された帽子があればその頭部スプライトを合成)
    const hatType = activeAccessories.hat ?? "hat_none";
    const hatVariant = NEW_CHAR_HAT_TO_VARIANT[hatType] ?? "base";
    const needsHeadSwap = hatVariant !== variant;
    const hatVariantSrc = NEW_CHARACTER_SPRITES[charId][hatVariant];
    const hatVariantHairSrc = hatVariantSrc.replace(/\.png$/, "-hair.png");
    const hatCoversBun =
      hatType === "hat_beret" || hatType === "hat_safari" || hatType === "hat_wizard";

    // 3. 靴 & 靴色
    const shoesType = activeAccessories.shoes ?? "shoes_sneaker";
    const shoesVariant = activeAccessories.shoes
      ? (NEW_CHAR_SHOES_TO_VARIANT[shoesType] ?? "base")
      : NATIVE_VARIANT_SHOES[variant];
    const needsShoesSwap = Boolean(activeAccessories.shoes) && shoesVariant !== NATIVE_VARIANT_SHOES[variant];
    const shoesVariantSrc = NEW_CHARACTER_SPRITES[charId][shoesVariant];

    const shoesColor = activeAccessories.shoes_color;
    let shoesFilter = shoesColor ? (SHOES_COLOR_FILTERS[shoesColor] ?? "none") : "none";
    // 新キャラの靴でストロベリーピンクが明示選択された場合はピンク着色フィルターを適用
    if (shoesColor === "shoes_color_pink") {
      shoesFilter = "sepia(0.65) hue-rotate(295deg) saturate(2.6) brightness(1.1)";
    }

    // 4. 手袋 & メガネ & アクセサリー
    const glovesType = activeAccessories.gloves ?? "gloves_none";
    const glassesType = activeAccessories.glasses ?? "glasses_none";
    const accessoryType = activeAccessories.accessory ?? "acc_none";
    const showWings =
      accessoryType === "acc_wings" && !(variant === "hero" && anchor.hasBakedWingsInHero);

    // ふわり・ひなたは hoodie(ミトン) / hero(金のグローブ) / base(素手) の3D手領域スプライトを持つ
    const hasNativeGloveSprites = Boolean(anchor.glovesClip);
    let glovesVariant: OutfitVariant | null = null;
    if (hasNativeGloveSprites) {
      if (glovesType === "gloves_mitten" && variant !== "hoodie") {
        glovesVariant = "hoodie";
      } else if (glovesType === "gloves_gold" && variant !== "hero") {
        glovesVariant = "hero";
      } else if (glovesType === "gloves_none" && (variant === "hoodie" || variant === "hero")) {
        glovesVariant = "base";
      }
    }

    return (
      <div
        className={`${styles.stage} ${mood === "celebrate" ? styles.celebrate : ""}`}
        role={onClick ? "button" : "img"}
        tabIndex={onClick ? 0 : undefined}
        aria-label={`${displayName}（${moodLabel}）`}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className={styles.characterContainer}>
          {showWings && (
            <AngelWings style={{ transform: anchor.wingsTransform, transformOrigin: "50% 40%" }} />
          )}

          {/* 背面髪型レイヤー（ボブ・ツインテール・ポニーテール・サイドテール・ロングウェーブ・くまみみツインおだんご・三つ編み・ハーフアップ） */}
          <NewCharacterHairstyleOverlay
            hairstyle={hairStyle}
            defaultHairstyle={defaultHairstyle}
            hairColor={hairColor}
            layer="back"
            baseToneFilter={anchor.baseHairToneFilter}
            transform={anchor.hairstyleTransform}
            hideTopBun={hatCoversBun}
          />

          {/* ベース全身衣装（帽子差し替え時は頭部領域をクリップ除外して衣装内蔵帽子の残骸を防止） */}
          <Image
            key={`char-${charId}-${charSrc}`}
            className={styles.sprite}
            src={charSrc}
            width={768}
            height={1024}
            alt=""
            draggable={false}
            unoptimized
            style={needsHeadSwap ? { clipPath: anchor.bodyWithoutHeadClip } : undefined}
          />

          {hairFilter !== "none" && (
            <Image
              key={`hair-${charId}-${variant}-${hairColor}`}
              className={styles.shoesOverlay}
              src={hairSrc}
              width={768}
              height={1024}
              alt=""
              draggable={false}
              unoptimized
              style={{
                clipPath: needsHeadSwap ? anchor.bodyWithoutHeadClip : undefined,
                filter: hairFilter,
                pointerEvents: "none",
              }}
            />
          )}

          {/* 帽子・頭部差し替えレイヤー（たんけんぼう・あかいベレーぼう・まほうのぼうし・きんのクラウン・なし） */}
          {needsHeadSwap && (
            <>
              <Image
                key={`hat-head-${charId}-${hatVariant}`}
                className={styles.shoesOverlay}
                src={hatVariantSrc}
                width={768}
                height={1024}
                alt=""
                draggable={false}
                unoptimized
                style={{
                  clipPath: anchor.headRegionClip,
                  pointerEvents: "none",
                }}
              />
              {hairFilter !== "none" && (
                <Image
                  key={`hat-hair-${charId}-${hatVariant}-${hairColor}`}
                  className={styles.shoesOverlay}
                  src={hatVariantHairSrc}
                  width={768}
                  height={1024}
                  alt=""
                  draggable={false}
                  unoptimized
                  style={{
                    clipPath: anchor.headRegionClip,
                    filter: hairFilter,
                    pointerEvents: "none",
                  }}
                />
              )}
            </>
          )}

          {/* 前面髪型レイヤー（おだんごアップ・ハーフアップリボン・サイドテールリボン） */}
          <NewCharacterHairstyleOverlay
            hairstyle={hairStyle}
            defaultHairstyle={defaultHairstyle}
            hairColor={hairColor}
            layer="front"
            baseToneFilter={anchor.baseHairToneFilter}
            transform={anchor.hairstyleTransform}
            hideTopBun={hatCoversBun}
          />

          {/* 靴差し替えレイヤー（くまちゃんスニーカー・たんけんブーツ・リボンパンプス・まほうのシューズ・ゆうしゃのブーツ） */}
          {needsShoesSwap && (
            <Image
              key={`shoes-swap-${charId}-${shoesVariant}`}
              className={styles.shoesOverlay}
              src={shoesVariantSrc}
              width={768}
              height={1024}
              alt=""
              draggable={false}
              unoptimized
              style={{
                clipPath: anchor.shoesClip,
                pointerEvents: "none",
              }}
            />
          )}

          {/* 靴カラー変更レイヤー */}
          {shoesFilter !== "none" && (
            <svg
              viewBox="0 0 768 1024"
              className={styles.shoesOverlay}
              style={{ pointerEvents: "none" }}
              aria-hidden="true"
            >
              <image
                href={shoesVariantSrc}
                width="768"
                height="1024"
                style={{
                  clipPath: anchor.shoesClip,
                  filter: shoesFilter,
                }}
              />
            </svg>
          )}

          {/* 手袋差し替えレイヤー（しろいミトン・きんのグローブ・なし） */}
          {glovesVariant && anchor.glovesClip && (
            <Image
              key={`gloves-swap-${charId}-${glovesVariant}`}
              className={styles.glovesOverlay}
              src={NEW_CHARACTER_SPRITES[charId][glovesVariant]}
              width={768}
              height={1024}
              alt=""
              draggable={false}
              unoptimized
              style={{
                clipPath: anchor.glovesClip,
                pointerEvents: "none",
              }}
            />
          )}
          {!hasNativeGloveSprites && glovesType !== "gloves_none" && (
            <NewCharacterGlovesOverlay charId={charId} gloves={glovesType} />
          )}

          {/* メガネレイヤー（まるめがね・ほしのサングラス） */}
          <NewCharacterGlassesOverlay charId={charId} glasses={glassesType} />

          {hatType === "hat_ribbon" && (
            <div
              className={styles.accessoryLayer}
              style={{
                top: anchor.ribbonTop,
                left: anchor.ribbonLeft,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden="true"
            >
              <RibbonBow />
            </div>
          )}

          {accessoryType === "acc_pin_star" && (
            <StarHairPin style={{ transform: anchor.pinTransform, transformOrigin: "60% 20%" }} />
          )}
          {accessoryType === "acc_heart_earring" && (
            <HeartEarring style={{ transform: anchor.earringTransform, transformOrigin: "50% 30%" }} />
          )}
          {accessoryType === "acc_wand" && variant !== "wizard" && (
            <MagicWand style={{ transform: anchor.wandTransform, transformOrigin: "25% 40%" }} />
          )}
          {accessoryType === "acc_bag_bear" && variant !== "hoodie" && (
            <BearPochette style={{ transform: anchor.bagTransform, transformOrigin: "45% 60%" }} />
          )}
        </div>
      </div>
    );
  }

  // 1. ベース衣装 (かのはちゃん)
  const baseSrc = getKanohaSprite(mood, activeAccessories, previewCategory);
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

  // 5. 帽子レイヤー (Hat: 茶髪おだんごやピンクリボンの残骸を除去したクリーンな単体帽子スプライトを使用)
  const hatType = activeAccessories.hat ?? "hat_none";

  let hatSrc: string | null = null;
  if (hatType === "hat_beret") {
    hatSrc = SPRITES.hatBeret;
  } else if (hatType === "hat_safari") {
    hatSrc = SPRITES.hatSafari;
  } else if (hatType === "hat_wizard") {
    hatSrc = SPRITES.hatWizard;
  } else if (hatType === "hat_crown") {
    hatSrc = SPRITES.hatCrown;
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
  let shoesFilter = SHOES_COLOR_FILTERS[shoesColor] ?? "none";
  // スニーカー以外の靴（茶ブーツ・赤パンプス・紫魔法靴・金勇者靴）でピンク色が明示選択された場合はピンク着色フィルターを適用
  if (
    activeAccessories.shoes_color === "shoes_color_pink" &&
    shoesType !== "shoes_sneaker"
  ) {
    shoesFilter = "sepia(0.65) hue-rotate(295deg) saturate(2.6) brightness(1.1)";
  }

  const hasExplicitShoes = Boolean(activeAccessories.shoes || activeAccessories.shoes_color);
  const isNativeShoeUncolored =
    shoesType === (NATIVE_OUTFIT_SHOES[currentClothes] ?? "shoes_sneaker") &&
    shoesFilter === "none";
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
      aria-label={`${displayName}（${moodLabel}）`}
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
            style={{ zIndex: 6 }}
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
