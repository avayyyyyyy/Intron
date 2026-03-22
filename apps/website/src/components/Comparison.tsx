"use client";

import { motion } from "framer-motion";

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M3 8l3 3 7-7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M4 4l8 8M12 4l-8 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const comparison = [
  {
    feature: "Open source",
    intron: true,
    operator: false,
    claude: false,
  },
  {
    feature: "DOM + Vision approach",
    intron: true,
    operator: false,
    claude: false,
  },
  {
    feature: "Model agnostic",
    intron: true,
    operator: false,
    claude: false,
  },
  {
    feature: "Built-in agent loop",
    intron: true,
    operator: true,
    claude: false,
  },
  {
    feature: "Cost",
    intron: "Free + LLM",
    operator: "$200/mo",
    claude: "Token-based",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="cell-text">{value}</span>;
  }
  return value ? (
    <span className="cell-check">
      <CheckIcon />
    </span>
  ) : (
    <span className="cell-cross">
      <CrossIcon />
    </span>
  );
}

export default function Comparison() {
  return (
    <section className="comparison" id="comparison">
      <div className="container">
        <div className="section-head">
          <div className="label">Why Intron</div>
          <h2 className="section-title">
            Built different.
            <br />
            <em>Priced right.</em>
          </h2>
          <p className="section-sub">
            DOM access + open source + model freedom = browser automation that actually works.
          </p>
        </div>

        <motion.div
          className="comparison-table"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={containerVariants}
        >
          <div className="comparison-header">
            <div className="comparison-feature" />
            <div className="comparison-col comparison-col-highlight">
              <span className="col-name">Intron</span>
              <span className="col-badge">Open source</span>
            </div>
            <div className="comparison-col">
              <span className="col-name">OpenAI Operator</span>
            </div>
            <div className="comparison-col">
              <span className="col-name">Claude Computer Use</span>
            </div>
          </div>

          {comparison.map((row) => (
            <motion.div
              key={row.feature}
              className="comparison-row"
              variants={rowVariants}
            >
              <div className="comparison-feature">{row.feature}</div>
              <div className="comparison-col comparison-col-highlight">
                <CellValue value={row.intron} />
              </div>
              <div className="comparison-col">
                <CellValue value={row.operator} />
              </div>
              <div className="comparison-col">
                <CellValue value={row.claude} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
