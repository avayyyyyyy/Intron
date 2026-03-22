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
        Automate any browser
        <br />
        <em>task in plain English.</em>
      </motion.h1>

      <motion.p
        className="hero-sub"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.35 }}
      >
        Open source. Works with any LLM. Describe what you need — Intron clicks,
        reads, and navigates so you don't have to.
      </motion.p>

      <motion.div
        className="hero-actions"
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.45 }}
      >
        <a
          href="https://github.com/avayyyyyyy/Intron"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Star on GitHub
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
        <a
          href="https://github.com/avayyyyyyy/Intron"
          target="_blank"
          rel="noopener noreferrer"
          className="github-badge"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="github-label">Open source on GitHub</span>
        </a>
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
