import Link from "next/link";
import PortfolioGallery from "./PortfolioGallery";

const expertise = [
  {
    icon: "◈",
    title: "SEO Strategy",
    items: [
      "On-page & technical SEO",
      "Keyword research & strategy",
      "Search visibility & growth",
    ],
  },
  {
    icon: "✦",
    title: "Content Strategy",
    items: [
      "Editorial planning",
      "Content development",
      "Performance-led storytelling",
    ],
  },
  {
    icon: "◌",
    title: "Analytics & Data",
    items: [
      "Google Analytics",
      "Search performance",
      "Data-driven decisions",
    ],
  },
  {
    icon: "⌘",
    title: "Web & UX",
    items: [
      "Website strategy",
      "UX-focused content",
      "Conversion-aware experiences",
    ],
  },
];

const recognition = [
  {
    number: "01",
    title: "Google Discover",
    text: "Editorial work featured in Google Discover, extending content reach beyond traditional keyword rankings.",
    meta: "Organic visibility",
  },
  {
    number: "02",
    title: "Free Press Journal",
    text: "Published editorial work with a focus on useful, engaging and discoverable content.",
    meta: "Editorial recognition",
  },
];

const projects = [
  {
    title: "Specialized Publishing",
    role: "SEO & Editorial Strategy",
    text: "Building search-led editorial systems designed to grow organic visibility while maintaining useful, audience-first content.",
    image: "/portfolio/sakshi/image-01.jpg",
    stats: ["SEO", "Content", "Organic Growth"],
  },
  {
    title: "Parenting & Family Content",
    role: "Content Strategy",
    text: "Developing content around high-intent audience questions, with a focus on discoverability, usefulness and sustainable traffic.",
    image: "/portfolio/sakshi/image-02.jpg",
    stats: ["Content Strategy", "Audience", "Search"],
  },
  {
    title: "Niche Communities",
    role: "Growth & Analytics",
    text: "Using analytics and search insights to identify opportunities, improve content performance and build repeatable growth systems.",
    image: "/portfolio/sakshi/image-03.jpg",
    stats: ["Analytics", "SEO", "Growth"],
  },
];

export default function SakshiPortfolio() {
  return (
    <main className="sakshi-page">
      {/* NAVIGATION */}
      <nav className="sx-nav">
        <div className="sx-container sx-nav-inner">
          <Link href="/" className="sx-brand">
            <span className="sx-logo">X</span>
            <span>Xredible</span>
          </Link>

          <div className="sx-links">
            <Link href="/">Home</Link>
            <a href="#expertise">Expertise</a>
            <a href="#recognition">Recognition</a>
            <a href="#work">Work</a>
            <a href="#about">About</a>
          </div>

          <a href="#contact" className="sx-nav-cta">
            Contact
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="sx-hero">
        <div className="sx-container sx-hero-grid">
          <div className="sx-hero-copy">
            <div className="sx-badge">
              <span />
              XREDIBLE PORTFOLIO / 01
            </div>

            <h1>
              Sakshi Kasat
              <span>SEO Strategist &amp; Editorial Leader</span>
            </h1>

            <p className="sx-lead">
              Building content that transcends traditional search through SEO,
              editorial strategy, analytics and emerging AI capabilities.
            </p>

            <div className="sx-actions">
              <a className="sx-btn sx-primary" href="#work">
                Explore Work →
              </a>

              <a className="sx-btn" href="#contact">
                Let&apos;s Collaborate
              </a>
            </div>
          </div>

          {/* CLEAN HERO VISUAL — NO GOOGLE ANALYTICS IMAGE */}
          <div className="sx-hero-visual">
            <div className="sx-glow sx-glow-one" />
            <div className="sx-glow sx-glow-two" />

            <div className="sx-hero-orb">
              <div className="sx-orb-ring sx-ring-one" />
              <div className="sx-orb-ring sx-ring-two" />

              <div className="sx-orb-center">
                <strong>SK</strong>
                <span>SEO · CONTENT · AI</span>
              </div>
            </div>

            <div className="sx-floating-card sx-card-seo">
              <b>SEO</b>
              <span>Strategy</span>
            </div>

            <div className="sx-floating-card sx-card-ai">
              <b>AI</b>
              <span>Automation</span>
            </div>

            <div className="sx-floating-card sx-card-data">
              <b>DATA</b>
              <span>Insights</span>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO STRIP */}
      <section className="sx-intro-strip">
        <div className="sx-container sx-intro-grid">
          <div>
            <span>01</span>
            <strong>Search</strong>
            <small>Visibility</small>
          </div>

          <div>
            <span>02</span>
            <strong>Content</strong>
            <small>Authority</small>
          </div>

          <div>
            <span>03</span>
            <strong>Analytics</strong>
            <small>Performance</small>
          </div>

          <div>
            <span>04</span>
            <strong>AI</strong>
            <small>Efficiency</small>
          </div>
        </div>
      </section>

      {/* EXPERTISE */}
      <section id="expertise" className="sx-section">
        <div className="sx-container">
          <div className="sx-section-head">
            <div>
              <div className="sx-kicker">Capabilities</div>
              <h2>Strategy that compounds.</h2>
            </div>

            <p>
              A blend of SEO, editorial leadership, analytics, web experience
              and AI capabilities.
            </p>
          </div>

          <div className="sx-expertise">
            {expertise.map((card) => (
              <article className="sx-card" key={card.title}>
                <div className="sx-icon">{card.icon}</div>

                <h3>{card.title}</h3>

                <ul>
                  {card.items.map((item) => (
                    <li key={item}>
                      <span>↗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="sx-focus">
            <div className="sx-kicker">Current focus</div>

            <h3>AI &amp; Automation for Content Operations</h3>

            <p>
              Hands-on learning around generative AI, prompt engineering,
              custom GPTs and AI automation workflows — amplifying human
              creativity while making content systems more scalable and
              measurable.
            </p>
          </div>
        </div>
      </section>

      {/* RECOGNITION */}
      <section id="recognition" className="sx-section">
        <div className="sx-container">
          <div className="sx-section-head">
            <div>
              <div className="sx-kicker">Recognition</div>
              <h2>Visibility beyond search.</h2>
            </div>

            <p>
              Editorial work with reach beyond conventional search results.
            </p>
          </div>

          <div className="sx-achievements">
            {recognition.map((item) => (
              <article className="sx-achievement" key={item.number}>
                <span className="sx-number">{item.number}</span>

                <h3>{item.title}</h3>

                <p>{item.text}</p>

                <small>{item.meta}</small>
              </article>
            ))}
          </div>

          {/* FULLSCREEN CLICKABLE GALLERY */}
          <PortfolioGallery />

          <div className="sx-gallery-note">
            Select any project image to view it in full size.
          </div>
        </div>
      </section>

      {/* SELECTED WORK */}
      <section id="work" className="sx-section">
        <div className="sx-container">
          <div className="sx-section-head">
            <div>
              <div className="sx-kicker">Selected work</div>
              <h2>From traffic to systems.</h2>
            </div>

            <p>
              Selected portfolio work and growth-focused content systems.
            </p>
          </div>

          <div className="sx-projects">
            {projects.map((project, index) => (
              <article
                className={`sx-project ${
                  index % 2 === 1 ? "sx-project-reverse" : ""
                }`}
                key={project.title}
              >
                <div className="sx-project-image">
                  {/* Clickable image is handled by the gallery above */}
                  <img
                    src={project.image}
                    alt={project.title}
                  />
                </div>

                <div className="sx-project-copy">
                  <div className="sx-kicker">{project.role}</div>

                  <h3>{project.title}</h3>

                  <p>{project.text}</p>

                  <div className="sx-tags">
                    {project.stats.map((stat) => (
                      <span key={stat}>{stat}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="sx-section">
        <div className="sx-container sx-about">
          <div>
            <div className="sx-kicker">About Sakshi</div>

            <h2>
              Human strategy.
              <br />
              <em>Smarter systems.</em>
            </h2>

            <p className="sx-about-lead">
              Make it meaningful. Make it measurable. Make it matter.
            </p>
          </div>

          <div className="sx-about-copy">
            <div>
              <b>Editorial leadership</b>

              <p>
                Combining editorial thinking with search strategy to create
                useful, discoverable content.
              </p>
            </div>

            <div>
              <b>Performance mindset</b>

              <p>
                Using analytics and search signals to turn content decisions
                into measurable outcomes.
              </p>
            </div>

            <div>
              <b>AI curiosity</b>

              <p>
                Exploring practical generative AI and automation workflows to
                make content operations more efficient.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="sx-contact">
        <div className="sx-container">
          <div className="sx-contact-box">
            <div className="sx-kicker">
              Let&apos;s build something useful
            </div>

            <h2>Ready to turn content into growth?</h2>

            <p>
              Interested in SEO strategy, content development, AI-powered
              initiatives or editorial projects?
            </p>

            <div className="sx-actions">
              <a
                className="sx-btn sx-primary"
                href="mailto:sakshikasat12@gmail.com"
              >
                Email Sakshi
              </a>

              <a
                className="sx-btn"
                href="https://www.linkedin.com/in/sakshi-kasat-kaushik/"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="sx-footer">
        <div className="sx-container">
          <span>© 2026 Xredible · Sakshi Kasat</span>
          <span>SEO · Content · AI</span>
        </div>
      </footer>

      <style>{`
        .sakshi-page {
          --bg: #05050a;
          --panel: rgba(18, 18, 30, 0.72);
          --line: rgba(255, 255, 255, 0.1);
          --text: #f7f7fb;
          --muted: #a6a6b8;
          --purple: #8b5cf6;
          --blue: #38bdf8;

          min-height: 100vh;
          color: var(--text);

          background:
            radial-gradient(
              900px 500px at 75% -10%,
              rgba(139, 92, 246, 0.2),
              transparent 65%
            ),
            radial-gradient(
              800px 500px at -10% 25%,
              rgba(56, 189, 248, 0.12),
              transparent 65%
            ),
            var(--bg);
        }

        .sx-container {
          width: min(calc(100% - 40px), 1180px);
          margin: 0 auto;
        }

        .sx-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid var(--line);
          background: rgba(5, 5, 10, 0.8);
          backdrop-filter: blur(18px);
        }

        .sx-nav-inner {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sx-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          color: white;
        }

        .sx-logo {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(
            135deg,
            var(--purple),
            var(--blue)
          );
        }

        .sx-links {
          display: flex;
          align-items: center;
          gap: 24px;
          color: #b9b9c7;
          font-size: 14px;
        }

        .sx-links a:hover {
          color: white;
        }

        .sx-nav-cta,
        .sx-btn {
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .sx-nav-cta {
          border-color: rgba(139, 92, 246, 0.5);
          background: rgba(139, 92, 246, 0.1);
          color: white;
        }

        .sx-hero {
          position: relative;
          min-height: calc(100vh - 72px);
          display: grid;
          align-items: center;
          overflow: hidden;
          padding: 90px 0;
        }

        .sx-hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 60px;
          align-items: center;
        }

        .sx-badge {
          display: inline-flex;
          gap: 9px;
          align-items: center;
          margin-bottom: 22px;
          color: #bfbfd0;
          font-size: 11px;
          letter-spacing: 0.13em;
        }

        .sx-badge span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 12px #34d399;
        }

        .sx-hero h1 {
          margin: 0;
          font-size: clamp(48px, 6vw, 82px);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .sx-hero h1 span {
          display: block;
          background: linear-gradient(
            90deg,
            #ffffff 10%,
            #b99cff 52%,
            #6fd7ff 95%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .sx-lead {
          max-width: 690px;
          margin: 28px 0 34px;
          color: var(--muted);
          font-size: 19px;
          line-height: 1.7;
        }

        .sx-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .sx-btn {
          color: white;
        }

        .sx-primary {
          border-color: transparent;
          background: linear-gradient(
            135deg,
            var(--purple),
            #6d4cf0
          );
          box-shadow: 0 12px 34px rgba(139, 92, 246, 0.22);
        }

        /* HERO VISUAL */

        .sx-hero-visual {
          position: relative;
          min-height: 500px;
          display: grid;
          place-items: center;
        }

        .sx-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(50px);
          pointer-events: none;
        }

        .sx-glow-one {
          width: 220px;
          height: 220px;
          top: 40px;
          right: 40px;
          background: rgba(139, 92, 246, 0.25);
        }

        .sx-glow-two {
          width: 180px;
          height: 180px;
          bottom: 60px;
          left: 30px;
          background: rgba(56, 189, 248, 0.16);
        }

        .sx-hero-orb {
          position: relative;
          width: 360px;
          height: 360px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 35% 30%,
              rgba(255, 255, 255, 0.12),
              transparent 25%
            ),
            radial-gradient(
              circle,
              rgba(139, 92, 246, 0.2),
              rgba(9, 9, 20, 0.95) 65%
            );
          border: 1px solid rgba(255, 255, 255, 0.13);
          box-shadow:
            0 0 80px rgba(139, 92, 246, 0.18),
            inset 0 0 80px rgba(139, 92, 246, 0.08);
        }

        .sx-orb-center {
          position: relative;
          z-index: 4;
          text-align: center;
        }

        .sx-orb-center strong {
          display: block;
          font-size: 92px;
          line-height: 1;
          letter-spacing: -0.1em;
          background: linear-gradient(
            135deg,
            #ffffff,
            var(--purple),
            var(--blue)
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .sx-orb-center span {
          display: block;
          margin-top: 12px;
          color: #aaaabd;
          font-size: 10px;
          letter-spacing: 0.22em;
        }

        .sx-orb-ring {
          position: absolute;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 50%;
        }

        .sx-ring-one {
          width: 430px;
          height: 180px;
          transform: rotate(25deg);
        }

        .sx-ring-two {
          width: 180px;
          height: 430px;
          transform: rotate(-25deg);
          border-color: rgba(56, 189, 248, 0.22);
        }

        .sx-floating-card {
          position: absolute;
          z-index: 10;
          display: flex;
          flex-direction: column;
          padding: 14px 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(15, 15, 25, 0.8);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(15px);
        }

        .sx-floating-card b {
          font-size: 16px;
        }

        .sx-floating-card span {
          margin-top: 3px;
          color: #9292a6;
          font-size: 10px;
        }

        .sx-card-seo {
          top: 70px;
          left: 10px;
        }

        .sx-card-ai {
          right: 5px;
          top: 170px;
        }

        .sx-card-data {
          bottom: 65px;
          left: 45px;
        }

        /* INTRO STRIP */

        .sx-intro-strip {
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.02);
        }

        .sx-intro-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .sx-intro-grid > div {
          padding: 25px;
          border-right: 1px solid var(--line);
        }

        .sx-intro-grid > div:last-child {
          border-right: 0;
        }

        .sx-intro-grid span {
          display: block;
          color: #77778a;
          font-size: 10px;
          margin-bottom: 8px;
        }

        .sx-intro-grid strong {
          display: block;
          font-size: 17px;
        }

        .sx-intro-grid small {
          color: #77778a;
        }

        /* SECTIONS */

        .sx-section {
          padding: 100px 0;
          border-top: 1px solid var(--line);
        }

        .sx-section-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 30px;
          margin-bottom: 40px;
        }

        .sx-kicker {
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          font-size: 11px;
          font-weight: 800;
        }

        .sx-section h2 {
          margin-top: 8px;
          font-size: clamp(36px, 4vw, 54px);
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .sx-section-head > p {
          max-width: 550px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* EXPERTISE */

        .sx-expertise {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .sx-card {
          min-height: 240px;
          padding: 24px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: var(--panel);
        }

        .sx-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          border-radius: 12px;
          background: rgba(139, 92, 246, 0.12);
          color: #c4b5fd;
        }

        .sx-card h3 {
          margin-bottom: 14px;
          font-size: 18px;
        }

        .sx-card ul {
          padding: 0;
          list-style: none;
          color: var(--muted);
          font-size: 14px;
        }

        .sx-card li {
          margin: 9px 0;
        }

        .sx-card li span {
          margin-right: 8px;
          color: var(--blue);
        }

        .sx-focus {
          margin-top: 18px;
          padding: 28px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(139, 92, 246, 0.12),
            rgba(56, 189, 248, 0.06)
          );
        }

        .sx-focus h3 {
          margin: 8px 0;
          font-size: 23px;
        }

        .sx-focus p {
          max-width: 850px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* RECOGNITION */

        .sx-achievements {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .sx-achievement {
          padding: 30px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: var(--panel);
        }

        .sx-number {
          color: #77778a;
          font-size: 12px;
        }

        .sx-achievement h3 {
          margin: 30px 0 10px;
          font-size: 25px;
        }

        .sx-achievement p {
          margin-bottom: 18px;
          color: var(--muted);
          line-height: 1.6;
        }

        .sx-achievement small {
          color: #8f8fa1;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .sx-gallery-note {
          margin-top: 18px;
          color: #777789;
          font-size: 12px;
          text-align: center;
        }

        /* PROJECTS */

        .sx-projects {
          display: grid;
          gap: 18px;
        }

        .sx-project {
          display: grid;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: var(--panel);
        }

        .sx-project-reverse .sx-project-image {
          order: 2;
        }

        .sx-project-reverse .sx-project-copy {
          order: 1;
        }

        .sx-project-image {
          position: relative;
          min-height: 380px;
          overflow: hidden;
          background: #09090f;
        }

        .sx-project-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .sx-project:hover .sx-project-image img {
          transform: scale(1.04);
        }

        .sx-project-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 42px;
        }

        .sx-project-copy h3 {
          margin: 8px 0 14px;
          font-size: 32px;
          letter-spacing: -0.035em;
        }

        .sx-project-copy p {
          color: var(--muted);
          line-height: 1.6;
        }

        .sx-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 24px;
        }

        .sx-tags span {
          padding: 7px 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: #c8c8d4;
          font-size: 11px;
        }

        /* ABOUT */

        .sx-about {
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 70px;
        }

        .sx-about h2 em {
          font-style: normal;
          background: linear-gradient(
            90deg,
            #b99cff,
            #6fd7ff
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .sx-about-lead {
          margin-top: 22px;
          color: #e8e8f0;
          font-size: 27px;
          line-height: 1.25;
        }

        .sx-about-copy {
          display: grid;
          gap: 26px;
        }

        .sx-about-copy > div {
          padding-bottom: 26px;
          border-bottom: 1px solid var(--line);
        }

        .sx-about-copy b {
          font-size: 17px;
        }

        .sx-about-copy p {
          margin-top: 7px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* CONTACT */

        .sx-contact {
          padding: 100px 0 120px;
          text-align: center;
        }

        .sx-contact-box {
          padding: 60px 30px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at 50% 0,
              rgba(139, 92, 246, 0.16),
              transparent 45%
            ),
            rgba(255, 255, 255, 0.025);
        }

        .sx-contact h2 {
          margin: 8px 0;
          font-size: clamp(40px, 5vw, 64px);
          letter-spacing: -0.05em;
        }

        .sx-contact p {
          max-width: 650px;
          margin: 15px auto 28px;
          color: var(--muted);
        }

        .sx-actions {
          justify-content: center;
        }

        /* FOOTER */

        .sx-footer {
          padding: 28px 0;
          border-top: 1px solid var(--line);
          color: #818191;
          font-size: 12px;
        }

        .sx-footer .sx-container {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
        }

        @media (max-width: 900px) {
          .sx-hero-grid,
          .sx-about {
            grid-template-columns: 1fr;
          }

          .sx-hero {
            padding: 70px 0;
          }

          .sx-hero-visual {
            min-height: 400px;
          }

          .sx-expertise {
            grid-template-columns: 1fr 1fr;
          }

          .sx-project {
            grid-template-columns: 1fr;
          }

          .sx-project-reverse .sx-project-image,
          .sx-project-reverse .sx-project-copy {
            order: initial;
          }

          .sx-project-image {
            min-height: 280px;
          }

          .sx-links {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .sx-container {
            width: calc(100% - 28px);
          }

          .sx-intro-grid {
            grid-template-columns: 1fr 1fr;
          }

          .sx-intro-grid > div:nth-child(2) {
            border-right: 0;
          }

          .sx-expertise,
          .sx-achievements {
            grid-template-columns: 1fr;
          }

          .sx-section {
            padding: 72px 0;
          }

          .sx-section-head {
            display: block;
          }

          .sx-section-head > p {
            margin-top: 16px;
          }

          .sx-hero-orb {
            width: 280px;
            height: 280px;
          }

          .sx-ring-one {
            width: 330px;
            height: 140px;
          }

          .sx-ring-two {
            width: 140px;
            height: 330px;
          }

          .sx-orb-center strong {
            font-size: 70px;
          }

          .sx-floating-card {
            padding: 10px 13px;
          }

          .sx-card-seo {
            left: 0;
          }

          .sx-card-ai {
            right: 0;
          }

          .sx-card-data {
            left: 20px;
          }

          .sx-project-copy {
            padding: 28px;
          }

          .sx-project-copy h3 {
            font-size: 27px;
          }

          .sx-contact {
            padding: 70px 0 90px;
          }
        }
      `}</style>
    </main>
  );
}