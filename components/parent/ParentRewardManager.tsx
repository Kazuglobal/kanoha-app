"use client";

import { useEffect, useState } from "react";
import { Gift, CheckCircle2, Clock, Plus, Trash2, Edit2, RotateCcw } from "lucide-react";
import styles from "@/components/kanoha.module.css";
import {
  getRealRewardItems,
  saveRealRewardItems,
  getRewardClaimTickets,
  fulfillTicket,
  cancelTicket,
  type RealRewardItem,
  type RewardClaimTicket,
  DEFAULT_REAL_REWARD_ITEMS,
} from "@/lib/rewards/realRewardStore";

export function ParentRewardManager() {
  const [items, setItems] = useState<RealRewardItem[]>([]);
  const [tickets, setTickets] = useState<RewardClaimTicket[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCost, setNewCost] = useState(50);
  const [newIcon, setNewIcon] = useState("🎁");
  const [newDesc, setNewDesc] = useState("");

  const refresh = () => {
    setItems(getRealRewardItems());
    setTickets(getRewardClaimTickets());
  };

  useEffect(() => {
    refresh();
    const handleTicketUpdate = () => refresh();
    const handleRewardUpdate = () => refresh();
    window.addEventListener("kanoha-reward-tickets-update", handleTicketUpdate);
    window.addEventListener("kanoha-real-rewards-update", handleRewardUpdate);
    return () => {
      window.removeEventListener("kanoha-reward-tickets-update", handleTicketUpdate);
      window.removeEventListener("kanoha-real-rewards-update", handleRewardUpdate);
    };
  }, []);

  const pendingTickets = tickets.filter((t) => t.status === "pending");
  const fulfilledTickets = tickets.filter((t) => t.status === "fulfilled");

  const handleFulfill = (id: string) => {
    fulfillTicket(id);
    refresh();
  };

  const handleCancel = (id: string) => {
    if (confirm("この申請を取り消しておこづかいを返金しますか？")) {
      cancelTicket(id);
      refresh();
    }
  };

  const handleToggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item,
    );
    saveRealRewardItems(updated);
    refresh();
  };

  const handleDeleteItem = (id: string) => {
    if (confirm("このごほうびを削除しますか？")) {
      const updated = items.filter((item) => item.id !== id);
      saveRealRewardItems(updated);
      refresh();
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem: RealRewardItem = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      category: "special",
      icon: newIcon || "🎁",
      costYen: Number(newCost) || 50,
      description: newDesc.trim() || "おうちの人と決めたごほうび！",
      enabled: true,
    };
    saveRealRewardItems([...items, newItem]);
    setNewTitle("");
    setNewDesc("");
    setNewCost(50);
    setIsAdding(false);
    refresh();
  };

  const handleResetDefaults = () => {
    if (confirm("ごほうびアイテムを初期設定に戻しますか？")) {
      saveRealRewardItems([...DEFAULT_REAL_REWARD_ITEMS]);
      refresh();
    }
  };

  return (
    <section className={styles.panel} style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <span className={styles.tiny}>モチベーション向上</span>
          <h2 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
            <Gift className={styles.rewardCoinIcon} size={22} style={{ color: "#d97706" }} />
            実物ごほうび（シール・お菓子）交換管理
          </h2>
          <p className={styles.muted} style={{ fontSize: "13px", margin: 0 }}>
            子どもが貯めたおこづかい（円）を、シールやお菓子、お出かけなどの実物チケットに交換できる仕組みです。
          </p>
        </div>
      </div>

      {/* 未渡しの交換申請チケット */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#1e293b", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock size={18} style={{ color: "#ef4444" }} />
          子どもからの交換申請（未渡し：{pendingTickets.length}件）
        </h3>

        {pendingTickets.length === 0 ? (
          <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "14px", color: "#64748b", fontSize: "13px", textAlign: "center" }}>
            現在、未渡しの交換申請はありません。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pendingTickets.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  background: "#fffbeb",
                  border: "2px solid #fde68a",
                  borderRadius: "16px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "32px" }}>{t.itemIcon}</span>
                  <div>
                    <strong style={{ fontSize: "16px", color: "#78350f" }}>{t.itemTitle}</strong>
                    <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>
                      🪙 {t.costYen}円分 ・ 申請日: {new Date(t.claimedAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleFulfill(t.id)}
                    className={styles.primaryButton}
                    style={{ padding: "8px 16px", fontSize: "13px", background: "#10b981", borderColor: "#10b981" }}
                  >
                    <CheckCircle2 size={16} />
                    あげたよ！（完了）
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(t.id)}
                    className={styles.secondaryButton}
                    style={{ padding: "8px 12px", fontSize: "12px", color: "#ef4444" }}
                  >
                    返金
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ごほうびアイテム設定 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#1e293b", margin: 0 }}>
            交換できるごほうび一覧・設定
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className={styles.secondaryButton}
              style={{ fontSize: "12px", padding: "6px 12px" }}
              onClick={handleResetDefaults}
            >
              <RotateCcw size={14} /> 初期設定に戻す
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              style={{ fontSize: "12px", padding: "6px 14px" }}
              onClick={() => setIsAdding(!isAdding)}
            >
              <Plus size={14} /> 新しいごほうびを追加
            </button>
          </div>
        </div>

        {/* 新規追加フォーム */}
        {isAdding && (
          <form
            onSubmit={handleAddItem}
            style={{
              padding: "16px",
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: "16px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <strong style={{ fontSize: "14px", color: "#0f172a" }}>新しいごほうびの登録</strong>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>絵文字</label>
                <input
                  type="text"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="🎁"
                  maxLength={4}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center", fontSize: "18px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>ごほうび名</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: すきなマンガ 1さつ"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>必要おこづかい</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={newCost}
                    onChange={(e) => setNewCost(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: 800 }}>円</span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>説明文・約束</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="例: 本屋さんで えらぼう！"
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                className={styles.secondaryButton}
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => setIsAdding(false)}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                style={{ fontSize: "12px", padding: "6px 16px" }}
              >
                保存する
              </button>
            </div>
          </form>
        )}

        {/* アイテムリスト */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                background: item.enabled ? "#ffffff" : "#f1f5f9",
                border: "1.5px solid",
                borderColor: item.enabled ? "#e2e8f0" : "#cbd5e1",
                borderRadius: "14px",
                opacity: item.enabled ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: "28px" }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong style={{ fontSize: "14px", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </strong>
                </div>
                <div style={{ fontSize: "12px", color: "#d97706", fontWeight: 800 }}>
                  🪙 {item.costYen} 円
                </div>
              </div>

              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  title={item.enabled ? "無効にする" : "有効にする"}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: item.enabled ? "#f0fdf4" : "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: item.enabled ? "#166534" : "#64748b",
                  }}
                >
                  {item.enabled ? "有効" : "停止中"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  title="削除"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "none",
                    background: "transparent",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 過去に渡した履歴 */}
      {fulfilledTickets.length > 0 && (
        <details style={{ marginTop: "20px", fontSize: "13px", color: "#64748b" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, padding: "8px 0" }}>
            渡したごほうびの履歴（{fulfilledTickets.length}件）
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
            {fulfilledTickets.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
              >
                <span>
                  {t.itemIcon} {t.itemTitle} ({t.costYen}円)
                </span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  ✓ 完了 ({t.fulfilledAt ? new Date(t.fulfilledAt).toLocaleDateString("ja-JP") : ""})
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
