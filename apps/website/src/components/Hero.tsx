"use client";

import { motion } from "framer-motion";

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle
      cx="7"
      cy="7"
      r="5.5"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M5 7l1.5 1.5L9.5 5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SmallLogo = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect width="14" height="14" rx="3" fill="#111" />
    <rect
      x="2"
      y="4.5"
      width="3.5"
      height="1"
      rx="0.5"
      fill="#E0E0E0"
    />
    <path
      d="M5.5 5C6.3 5 6.3 8 8.5 8"
      stroke="#E0E0E0"
      strokeWidth="0.9"
      strokeLinecap="round"
      opacity="0.4"
    />
    <rect
      x="8.5"
      y="7.5"
      width="3.5"
      height="1"
      rx="0.5"
      fill="#E0E0E0"
    />
    <rect
      x="2"
      y="9"
      width="10"
      height="1"
      rx="0.5"
      fill="#888"
      opacity="0.4"
    />
  </svg>
);

export default function Hero() {
  return (
    <section className="hero">
      <div className="glow-main" />
      <div className="glow-sides" />

      <motion.div
        className="hero-badge"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      >
        <span className="badge-dot" />
        Early access · Chrome Extension
      </motion.div>

      <motion.h1
        className="hero-title"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
      >
        The AI agent that
        <br />
        <em>lives in your browser.</em>
      </motion.h1>

      <motion.p
        className="hero-sub"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.35 }}
      >
        Open the side panel. Describe what you need. Intron clicks, reads,
        navigates, and reasons — on any page, without scripts or setup.
      </motion.p>

      <motion.div
        className="hero-actions"
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.45 }}
      >
        <a href="#cta" className="btn btn-primary btn-lg">
          <CheckIcon />
          Add to Chrome — free
        </a>
        <a href="#how" className="btn btn-secondary btn-lg">
          See how it works
        </a>
      </motion.div>

      <motion.div
        className="hero-trust"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.55 }}
      >
        <div className="avatars">
          <div className="av av-1">AK</div>
          <div className="av av-2">SP</div>
          <div className="av av-3">LM</div>
          <div className="av av-4">RJ</div>
        </div>
        <span className="trust-text">
          Joined by <strong>847 developers</strong> on the waitlist
        </span>
      </motion.div>

      <motion.div
        className="mockup-wrap"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.65 }}
      >
        <div className="hero-mockup">
          <div className="mockup-bar">
            <div className="tc tc-r" />
            <div className="tc tc-a" />
            <div className="tc tc-g" />
            <span className="mock-url">notion.so/workspace/My-Tasks</span>
          </div>
          <div className="mock-body">
            <div className="mock-page">
              <div className="sk sk-h" />
              <div className="sk" />
              <div className="sk sk-s" />
              <div className="sk-sep" />
              <div className="sk sk-xs" />
              <div className="sk" />
              <div className="sk sk-hl" />
              <div className="sk sk-hl2" />
              <div className="sk sk-s" />
              <div className="sk-sep" />
              <div className="sk sk-xs" />
              <div className="sk" />
              <div className="sk sk-s" />
              <div className="sk" />
            </div>
            <div className="mock-panel">
              <div className="panel-hd">
                <SmallLogo />
                Intron
              </div>
              <div className="panel-msgs">
                <div className="pm pm-u">Mark all overdue tasks as done</div>
                <div className="pm pm-a">
                  Scanning for overdue tasks…
                  <br />
                  <span className="tt">↗ get_page_content()</span>
                </div>
                <div className="pm pm-a">
                  Found 4. Clicking each checkbox now.
                  <br />
                  <span className="tt">
                    ↗ click(&quot;.task-checkbox&quot;, {"{index: 0}"})
                  </span>
                </div>
                <div className="pm pm-u">Good. Now export to CSV</div>
                <div className="pm pm-a">
                  <span className="pb" />
                </div>
              </div>
              <div className="panel-in">
                <div className="pin">Ask Intron anything…</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
