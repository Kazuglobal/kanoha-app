"use client";

import { Eraser, PenLine } from "lucide-react";
import { useRef, useState } from "react";
import styles from "@/components/kanoha.module.css";

interface HandwritingPadProps {
  childId: string;
  onAnswer: (answer: string) => void;
  problemId: string;
}

export function HandwritingPad({ childId, onAnswer, problemId }: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawingRef.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineWidth = 6;
    context.lineCap = "round";
    context.strokeStyle = "#17324d";
    context.lineTo(x, y);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setStatus("");
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas || pending) return;
    setPending(true);
    setStatus("よみとっているよ...");
    const [, base64] = canvas.toDataURL("image/png").split(",");
    const response = await fetch("/api/ai/recognize-handwriting", {
      body: JSON.stringify({
        childId,
        image: { data: base64 ?? "", mimeType: "image/png" },
        problemId,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      setStatus("うまく よみとれなかったよ。すうじで にゅうりょくしてね。");
      setPending(false);
      return;
    }
    onAnswer(body.data.answer);
    setStatus(`「${body.data.answer}」と よみとったよ。`);
    setPending(false);
  }

  if (!open) {
    return (
      <button className={styles.secondaryButton} type="button" onClick={() => setOpen(true)}>
        <PenLine aria-hidden="true" size={20} />
        てがきで こたえる
      </button>
    );
  }

  return (
    <div className={styles.handwritingPad}>
      <canvas
        aria-label="てがき入力"
        className={styles.handwritingCanvas}
        height={160}
        onPointerDown={startDrawing}
        onPointerLeave={stopDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        ref={canvasRef}
        width={320}
      />
      <div className={styles.handwritingActions}>
        <button className={styles.secondaryButton} onClick={clear} type="button">
          <Eraser aria-hidden="true" size={20} />
          けす
        </button>
        <button
          className={styles.primaryButton}
          disabled={pending}
          onClick={() => void submit()}
          type="button"
        >
          これで こたえる
        </button>
      </div>
      {status ? <p className={styles.feedback}>{status}</p> : null}
    </div>
  );
}
