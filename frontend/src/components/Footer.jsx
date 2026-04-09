import { motion } from "framer-motion";
import { Waves, Heart, Twitter, Github, Linkedin, Send } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Interactive Maps", href: "#maps" },
    { label: "Data Export", href: "#export" },
    { label: "API Access", href: "#api" },
  ],
  Resources: [
    { label: "Documentation", href: "#docs" },
    { label: "ARGO Network", href: "#argo" },
    { label: "Research Papers", href: "#research" },
    { label: "Blog", href: "#blog" },
  ],
  Company: [
    { label: "About Us", href: "#about" },
    { label: "Careers", href: "#careers" },
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Terms of Service", href: "#terms" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#" },
  { icon: Github, href: "#" },
  { icon: Linkedin, href: "#" },
];

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(226, 232, 240, 0.8)",
        background: "white",
        padding: "80px 20px 40px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "40px",
            marginBottom: "60px",
          }}
        >
          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "20px",
                  fontSize: 16,
                }}
              >
                {category}
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {links.map((link) => (
                  <li key={link.label}>
                    <motion.a
                      href={link.href}
                      style={{
                        color: "#64748b",
                        textDecoration: "none",
                        fontSize: 15,
                        transition: "all 0.2s",
                        display: "inline-block",
                      }}
                      whileHover={{ x: 6, color: "#0ea5e9" }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {link.label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            paddingTop: "32px",
            borderTop: "1px solid rgba(226, 232, 240, 0.8)",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Made with{" "}
            <Heart
              style={{
                width: 16,
                height: 16,
                color: "#f43f5e",
                fill: "#f43f5e",
              }}
            />{" "}
            in the Ocean
            <span>© {new Date().getFullYear()} FloatChat AI</span>
          </p>
          <div style={{ display: "flex", gap: "16px" }}>
            {socialLinks.map((social, i) => (
              <motion.a
                key={i}
                href={social.href}
                style={{ color: "#94a3b8", transition: "all 0.3s" }}
                whileHover={{ scale: 1.3, color: "#0ea5e9", rotate: 10 }}
                whileTap={{ scale: 0.9 }}
              >
                <social.icon style={{ width: 20, height: 20 }} />
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
