"use client";
import React from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ResetButton() {
  async function onReset() {
    try {
      await fetch(`${API}/reset`, { method: "POST" });
    } catch {
      // ignore network errors; still reload to clear UI
    } finally {
      location.reload();
    }
  }

  return (
    <button
      onClick={onReset}
      className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg transition"
      title="Clear history & reset the learning model"
    >
      Reset
    </button>
  );
}