"use client";

import { motion } from "framer-motion";

const models = ["Claude 3.5", "GPT-4o", "Gemini 1.5", "Mistral", "DeepSeek"];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function Compat() {
  return (
    <div className="compat">
      <div className="compat-inner">
        <span className="compat-label">Works with</span>
        <motion.div
          className="compat-models"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {models.map((model) => (
            <motion.div
              key={model}
              className="model-chip"
              variants={itemVariants}
              whileHover={{ y: -1 }}
            >
              <span className="model-dot" />
              {model}
            </motion.div>
          ))}
          <span className="compat-sep" />
          <span className="model-more">+ any OpenRouter model</span>
        </motion.div>
      </div>
    </div>
  );
}
