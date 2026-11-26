import { TrendingUp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="site-footer" id="how-it-works">
      <div className="container">
        <div className="footer-top">
          <div className="brand footer-brand"><span className="brand-mark"><TrendingUp size={18}/></span><span>FIRE<span className="brand-accent">path</span></span></div>
          <p>Know Your Wealth. Plan Your Freedom.</p>
          <div className="footer-links"><a href="/#features">Features</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund-policy">Refunds</a><a href="/delete-account">Delete account</a></div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} FIREpath. All rights reserved.</span>
          <p>Financial planning and educational tools. Calculations are illustrative, depend on user-entered assumptions and do not guarantee outcomes. This platform does not provide personalised securities investment recommendations.</p>
        </div>
      </div>
    </footer>
  );
}
