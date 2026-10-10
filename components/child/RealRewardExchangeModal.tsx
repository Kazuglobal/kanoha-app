"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Sparkles, Ticket, CheckCircle2, Clock } from "lucide-react";
import styles from "./RealRewardExchangeModal.module.css";
import { soundManager } from "@/lib/audio/soundSystem";
import { getRewardState } from "@/lib/rewards/rewardStore";
import {
  getRealRewardItems,
  getRewardClaimTickets,
  claimRealReward,
  type RealRewardItem,
  type RewardClaimTicket,
} from "@/lib/rewards/realRewardStore";

interface RealRewardExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RealRewardExchangeModal({ isOpen, onClose }: RealRewardExchangeModalProps) {
  const [activeTab, setActiveTab] = useState<"items" | "tickets">("items");
  const [balanceYen, setBalanceYen] = useState(0);
  const [items, setItems] = useState<RealRewardItem[]>([]);
  const [tickets, setTickets] = useState<RewardClaimTicket[]>([]);
  const [justClaimed, setJustClaimed] = useState<RewardClaimTicket | null>(null);

  const refreshData = () => {
    setBalanceYen(getRewardState().totalRewardYen);
    setItems(getRealRewardItems().filter((item) => item.enabled));
    setTickets(getRewardClaimTickets());
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleRewardUpdate = () => refreshData();
    const handleTicketUpdate = () => refreshData();
    window.addEventListener("kanoha-reward-update", handleRewardUpdate);
    window.addEventListener("kanoha-reward-tickets-update", handleTicketUpdate);
    return () => {
      window.removeEventListener("kanoha-reward-update", handleRewardUpdate);
      window.removeEventListener("kanoha-reward-tickets-update", handleTicketUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const handleClaim = (item: RealRewardItem) => {
    if (balanceYen < item.costYen) return;
    soundManager.playCelebrate();
    const ticket = claimRealReward(item);
    if (ticket) {
      setJustClaimed(ticket);
      refreshData();
    }
  };

  const pendingTicketsCount = tickets.filter((t) => t.status === "pending").length;

  return (
    <AnimatePresence>
      <div className={styles.modalOverlay} role="dialog" aria-modal="true">
        <motion.div
          className={styles.modalCard}
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          <button
            className={styles.modalClose}
            onClick={() => {
              soundManager.playTap();
              setJustClaimed(null);
              onClose();
            }}
            aria-label="とじる"
            type="button"
          >
            <X size={20} />
          </button>

          {/* Just Claimed Success Screen */}
          {justClaimed ? (
            <div className={styles.bodyContent} style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: "64px", animation: "bounce 1s infinite" }}>
                {justClaimed.itemIcon}
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#d97706", margin: "12px 0 6px" }}>
                🎉 こうかん できたよ！！
              </h2>
              <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 16px", fontWeight: 700 }}>
                「{justClaimed.itemTitle}」の ごほうびチケットを ゲット！
              </p>

              <div className={styles.issuedTicketBox}>
                <span className={styles.ticketBadgePending}>
                  <Clock size={12} /> おうちのひとに みせてね！
                </span>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#78350f", marginTop: "8px" }}>
                  {justClaimed.itemTitle}
                </div>
                <div style={{ fontSize: "13px", color: "#b45309", marginTop: "4px", fontWeight: 700 }}>
                  🪙 {justClaimed.costYen}円ぶん つかったよ
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
                <button
                  type="button"
                  className={styles.exchangeButton}
                  style={{ padding: "12px 24px", fontSize: "14px" }}
                  onClick={() => {
                    soundManager.playTap();
                    setJustClaimed(null);
                    setActiveTab("tickets");
                  }}
                >
                  <Ticket size={18} /> チケットを みる
                </button>
                <button
                  type="button"
                  style={{
                    padding: "12px 20px",
                    borderRadius: "14px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    soundManager.playTap();
                    setJustClaimed(null);
                  }}
                >
                  もっと えらぶ
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={styles.modalHeader}>
                <div className={styles.headerBadge}>
                  <Gift size={16} />
                  <span>ごほうび こうかんじょ</span>
                </div>
                <h2 className={styles.modalTitle}>ためた おこづかいを ごほうびに！</h2>
                <p className={styles.modalSubtitle}>
                  シールやおかしと こうかんできるよ！ おうちのひとに みせてね！
                </p>

                <div className={styles.balanceBanner}>
                  <span className={styles.balanceLabel}>いまの おこづかい：</span>
                  <strong className={styles.balanceValue}>🪙 {balanceYen} 円</strong>
                </div>
              </div>

              {/* Tab Bar */}
              <div className={styles.tabBar}>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === "items" ? styles.tabButtonActive : ""}`}
                  onClick={() => {
                    soundManager.playTap();
                    setActiveTab("items");
                  }}
                >
                  <Gift size={16} /> ごほうびを えらぶ
                </button>
                <button
                  type="button"
                  className={`${styles.tabButton} ${activeTab === "tickets" ? styles.tabButtonActive : ""}`}
                  onClick={() => {
                    soundManager.playTap();
                    setActiveTab("tickets");
                  }}
                >
                  <Ticket size={16} /> チケットばこ
                  {pendingTicketsCount > 0 && (
                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: "999px",
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: 900,
                      }}
                    >
                      {pendingTicketsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Body */}
              <div className={styles.bodyContent}>
                {activeTab === "items" ? (
                  <div className={styles.itemsList}>
                    {items.map((item) => {
                      const canAfford = balanceYen >= item.costYen;
                      const diff = item.costYen - balanceYen;

                      return (
                        <div
                          key={item.id}
                          className={`${styles.itemCard} ${canAfford ? styles.itemCardAffordable : ""}`}
                        >
                          <div className={styles.itemIconWrap}>{item.icon}</div>
                          <div className={styles.itemInfo}>
                            <div className={styles.itemTitleRow}>
                              <span className={styles.itemTitle}>{item.title}</span>
                              <span className={styles.itemCost}>{item.costYen}円</span>
                            </div>
                            <p className={styles.itemDesc}>{item.description}</p>
                          </div>

                          {canAfford ? (
                            <button
                              type="button"
                              className={styles.exchangeButton}
                              onClick={() => handleClaim(item)}
                            >
                              <Sparkles size={14} />
                              こうかん！
                            </button>
                          ) : (
                            <span className={styles.disabledTag}>あと {diff}円！</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Tickets List */
                  <div className={styles.itemsList}>
                    {tickets.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                        <Ticket size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <p style={{ fontWeight: 800, margin: 0 }}>まだ チケットが ないよ</p>
                        <p style={{ fontSize: "12px", marginTop: "4px" }}>
                          もんだいを といて おこづかいを ためたら こうかんしよう！
                        </p>
                      </div>
                    ) : (
                      tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className={`${styles.ticketCard} ${ticket.status === "fulfilled" ? styles.ticketFulfilled : ""}`}
                        >
                          <div className={styles.itemIconWrap}>{ticket.itemIcon}</div>
                          <div className={styles.itemInfo}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <strong style={{ fontSize: "15px", color: "#1e293b" }}>{ticket.itemTitle}</strong>
                              {ticket.status === "pending" ? (
                                <span className={styles.ticketBadgePending}>
                                  <Clock size={11} /> おうちのひとに みせてね
                                </span>
                              ) : (
                                <span className={styles.ticketBadgeDone}>
                                  <CheckCircle2 size={11} /> もらったよ！
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: "11px", color: "#64748b", margin: 0, fontWeight: 700 }}>
                              {new Date(ticket.claimedAt).toLocaleDateString("ja-JP", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              に こうかん （{ticket.costYen}円）
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
