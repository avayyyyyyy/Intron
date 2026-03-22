"use client";

import { motion } from "framer-motion";

const metrics = [
  { value: "12+", label: "Browser tools" },
  { value: "Any page", label: "No site restrictions" },
  { value: "Side panel", label: "Always accessible" },
  { value: "Your key", label: "No data leaves your machine" },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function Metrics() {
  return (
    <div className="metrics">
      <motion.div
        className="metrics-inner container"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        {metrics.map((metric) => (
          <motion.div key={metric.value} className="metric" variants={itemVariants}>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-label">{metric.label}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
