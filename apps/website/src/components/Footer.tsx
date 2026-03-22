const LogoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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

export default function Footer() {
  return (
    <footer>
      <div className="footer-logo">
        <LogoIcon />
        Intron
      </div>
      <ul className="footer-links">
        <li>
          <a href="#">Privacy</a>
        </li>
        <li>
          <a href="#">Terms</a>
        </li>
        <li>
          <a href="#">Docs</a>
        </li>
        <li>
          <a href="https://intron.dev">intron.dev</a>
        </li>
      </ul>
      <span className="footer-copy">© 2026 Intron</span>
    </footer>
  );
}
