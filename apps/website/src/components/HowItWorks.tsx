"use client";

import { motion } from "framer-motion";

const ArrowIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path
      d="M2 5h6M5.5 2.5L8 5l-2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const steps = [
  {
    num: 1,
    title: "Install the extension",
    desc: "Add Intron to Chrome in one click. No account, no configuration. Open any tab, press the side panel icon — the agent is ready.",
  },
  {
    num: 2,
    title: "Describe your task",
    desc: 'Type what you need in plain language. "Find all pricing tiers." "Fill this form." "Extract every email." Intron understands intent, not just commands.',
  },
  {
    num: 3,
    title: "Watch it execute",
    desc: "Intron scrolls, clicks, and reads with each step visible in the panel. Interrupt at any point, redirect mid-task, or let it finish.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { x: -12, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function HowItWorks() {
  return (
    <section className="how" id="how">
      <div className="container">
        <div className="label">How it works</div>
        <h2 className="section-title" style={{ marginTop: 18 }}>
          Three steps.
          <br />
          <em>Zero overhead.</em>
        </h2>
        <motion.div
          className="steps"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {steps.map((step) => (
            <motion.div key={step.num} className="step" variants={itemVariants}>
              <div className="step-num-badge">{step.num}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-desc">{step.desc}</div>
              {step.num < 3 && (
                <div className="step-arrow">
                  <ArrowIcon />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
