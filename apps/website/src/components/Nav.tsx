"use client";

import { motion } from "framer-motion";

const LogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#111" />
    <rect
      x="3.5"
      y="7.5"
      width="5.5"
      height="1.5"
      rx="0.75"
      fill="#E0E0E0"
    />
    <path
      d="M9 8.25 C10.5 8.25 10.5 13.5 14.5 13.5"
      stroke="#E0E0E0"
      strokeWidth="1.3"
      strokeLinecap="round"
      opacity="0.4"
    />
    <rect
      x="15"
      y="12.75"
      width="5.5"
      height="1.5"
      rx="0.75"
      fill="#E0E0E0"
    />
    <rect
      x="3.5"
      y="15"
      width="17"
      height="1.5"
      rx="0.75"
      fill="#888"
      opacity="0.45"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path
      d="M2 5.5h7M6 2.5l3 3-3 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Nav() {
  return (
    <motion.nav
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0 }}
    >
      <a href="/" className="nav-logo">
        <LogoIcon />
        Intron
      </a>
      <ul className="nav-links">
        <li>
          <a href="#features">Features</a>
        </li>
        <li>
          <a href="#how">How it works</a>
        </li>
        <li>
          <a href="#">Docs</a>
        </li>
        <li>
          <a href="#">GitHub</a>
        </li>
      </ul>
      <div className="nav-right">
        <button className="btn btn-ghost">Sign in</button>
        <a href="#cta" className="btn btn-primary">
          Add to Chrome
          <ArrowIcon />
        </a>
      </div>
    </motion.nav>
  );
}
