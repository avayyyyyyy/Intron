"use client";

import { motion } from "framer-motion";

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M5 7l1.5 1.5L9.5 5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function CTA() {
  return (
    <section className="cta" id="cta">
      <div className="container">
        <motion.div
          className="cta-box"
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, ease: "easeOut" as const }}
        >
          <h2 className="cta-title">
            Your browser,
            <br />
            <em>intelligently extended.</em>
          </h2>
          <p className="cta-sub">Free. Open source. Install in 2 minutes.</p>
          <a
            href="#"
            className="btn btn-primary btn-lg"
            style={{ position: "relative", zIndex: 1 }}
          >
            <CheckIcon />
            Add to Chrome — free
          </a>
        </motion.div>
      </div>
    </section>
  );
}
