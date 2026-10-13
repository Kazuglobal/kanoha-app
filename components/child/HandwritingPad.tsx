"use client";

import { BookOpen, Eraser, PenLine, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";
import type { Subject } from "@/lib/curriculum/subjects";

interface HandwritingPadProps {
  childId: string;
  onAnswer: (answer: string) => void;
  onSubmitAnswer?: (answer: string) => void;
  problemId: string;
  subject?: Subject;
}

const READ_FAILED_MESSAGE: Readonly<Record<Subject, string>> = {
  math: "うまく よみとれなかったよ。すうじで にゅうりょくしてね。",
  japanese: "うまく よみとれなかったよ。もういちど かくか、キーボードで にゅうりょくしてね。",
  english: "うまく よみとれなかったよ。もういちど ゆっくり かいてね。",
};

const PAD_TITLE: Readonly<Record<Subject, string>> = {
  math: "てがきノート（ひろびろ）",
  japanese: "漢字・ことば てがきノート",
  english: "アルファベット てがきノート",
};

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  width: number;
  color: string;
}

export function HandwritingPad({
  childId,
  onAnswer,
  onSubmitAnswer,
  problemId,
  subject = "math",
}: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const [strokeCount, setStrokeCount] = useState(0);

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [penWidth, setPenWidth] = useState<number>(7);
  const [gridMode, setGridMode] = useState<"single" | "double" | "none">("single");

  const penColor = "#112233";

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / (rect.width || 1);
    const scaleY = event.currentTarget.height / (rect.height || 1);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
    drawingRef.current = true;
    const { x, y } = point(event);
    currentStrokeRef.current = [{ x, y }];
    context.lineWidth = penWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = penColor;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    currentStrokeRef.current.push({ x, y });
    context.lineWidth = penWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = penColor;
    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event) {
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }
    }
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push({
        points: [...currentStrokeRef.current],
        width: penWidth,
        color: penColor,
      });
      currentStrokeRef.current = [];
      setStrokeCount(strokesRef.current.length);
    }
  }

  function redraw() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      context.lineWidth = stroke.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = stroke.color;

      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 1) {
        context.lineTo(stroke.points[0].x, stroke.points[0].y);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          context.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
      }
      context.stroke();
    }
  }

  function undo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokeCount(0);
    setStatus("");
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas || pending) return;
    setPending(true);
    setStatus("よみとっているよ...");

    let base64 = "";
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext("2d");
      if (exportCtx) {
        exportCtx.fillStyle = "#ffffff";
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(canvas, 0, 0);
      }
      const dataUrl = exportCtx ? exportCanvas.toDataURL("image/png") : canvas.toDataURL("image/png");
      base64 = dataUrl.split(",")[1] ?? "";
    } catch {
      base64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
    }

    const response = await fetch("/api/ai/recognize-handwriting", {
      body: JSON.stringify({
        childId,
        image: { data: base64, mimeType: "image/png" },
        problemId,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setStatus(READ_FAILED_MESSAGE[subject]);
      setPending(false);
      return;
    }
    onAnswer(body.data.answer);
    if (onSubmitAnswer) {
      onSubmitAnswer(body.data.answer);
    }
    setStatus(`「${body.data.answer}」と よみとって こたえあわせをしたよ！`);
    setPending(false);
    // 認識成功時はモーダルをスムーズに閉じて問題画面へ戻す
    setTimeout(() => {
      setOpen(false);
    }, 700);
  }

  if (!open) {
    return (
      <button className={styles.toySecondaryBtn} type="button" onClick={() => setOpen(true)}>
        <PenLine aria-hidden="true" size={20} />
        てがきで こたえる
      </button>
    );
  }

  const gridClass =
    gridMode === "single"
      ? styles.handwritingCanvasSingle
      : gridMode === "double"
        ? styles.handwritingCanvasDouble
        : styles.handwritingCanvasNoGrid;

  return (
    <div
      className={styles.handwritingModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="てがきノート"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className={styles.handwritingModalCard}>
        <div className={styles.handwritingHeader}>
          <h4 className={styles.handwritingTitle}>
            <BookOpen aria-hidden="true" size={20} />
            {PAD_TITLE[subject]}
          </h4>
          <div className={styles.handwritingModeSwitch}>
            <button
              className={`${styles.handwritingModeBtn} ${gridMode === "single" ? styles.handwritingModeBtnActive : ""}`}
              type="button"
              onClick={() => setGridMode("single")}
            >
              1文字マス
            </button>
            <button
              className={`${styles.handwritingModeBtn} ${gridMode === "double" ? styles.handwritingModeBtnActive : ""}`}
              type="button"
              onClick={() => setGridMode("double")}
            >
              2文字マス
            </button>
            <button
              className={`${styles.handwritingModeBtn} ${gridMode === "none" ? styles.handwritingModeBtnActive : ""}`}
              type="button"
              onClick={() => setGridMode("none")}
            >
              なし
            </button>
          </div>
          <button
            className={styles.ghostButton}
            onClick={() => setOpen(false)}
            type="button"
            aria-label="閉じる"
            style={{ padding: "6px", minHeight: "auto", borderRadius: "99px" }}
          >
            <X size={20} />
          </button>
        </div>

        <div className={`${styles.handwritingCanvasWrapper} ${gridClass}`}>
          <canvas
            aria-label="てがき入力"
            className={styles.handwritingCanvas}
            height={380}
            onPointerDown={startDrawing}
            onPointerLeave={stopDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            ref={canvasRef}
            width={540}
          />
        </div>

        <div className={styles.handwritingToolbar}>
          <div className={styles.handwritingPenGroup}>
            <span style={{ fontSize: "14px", fontWeight: 800 }}>ペンのふとさ:</span>
            <button
              className={`${styles.handwritingPenBtn} ${penWidth === 6 ? styles.handwritingPenBtnActive : ""}`}
              type="button"
              onClick={() => setPenWidth(6)}
            >
              ふつう
            </button>
            <button
              className={`${styles.handwritingPenBtn} ${penWidth === 9 ? styles.handwritingPenBtnActive : ""}`}
              type="button"
              onClick={() => setPenWidth(9)}
            >
              ふとい
            </button>
          </div>

          <div className={styles.handwritingToolButtons}>
            <button
              className={styles.handwritingSmallBtn}
              disabled={strokeCount === 0}
              onClick={undo}
              type="button"
              title="直前の1画を取り消します"
            >
              <RotateCcw aria-hidden="true" size={16} />
              1つもどす
            </button>
            <button className={styles.handwritingSmallBtn} onClick={clear} type="button">
              <Eraser aria-hidden="true" size={16} />
              けす
            </button>
          </div>
        </div>

        <div className={styles.handwritingActions} style={{ marginTop: "12px" }}>
          <button
            className={styles.secondaryButton}
            onClick={() => setOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
            とじる
          </button>
          <button
            className={styles.toyAnswerButton}
            disabled={pending}
            onClick={() => void submit()}
            type="button"
          >
            {pending ? "よみとり中..." : "これで こたえる"}
          </button>
        </div>

        {status ? <p className={styles.feedback}>{status}</p> : null}
      </div>
    </div>
  );
}
