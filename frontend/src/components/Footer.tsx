"use client";
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-accent" aria-hidden="true" />
        <p className="footer-text">
          Made with <span className="heart" aria-label="love" role="img">❤</span> by <span className="author">Manya Shukla</span> · <span className="year">2025</span>
        </p>
      </div>
    </footer>
  );
}
