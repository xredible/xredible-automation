"use client";

export default function XredibleAutomationWebsite() {
  const whatsappNumber = "918085949384";
  const calendlyLink = "https://wa.me/918085949384";

  const services = [
    {
      title: "n8n Workflow Automation",
      desc: "Custom workflows that automate repetitive business tasks, CRM updates, lead routing, notifications, reporting, and more.",
      icon: "⚡",
    },
    {
      title: "AI Marketing Systems",
      desc: "AI-powered content generation, lead nurturing, automated campaigns, and smart customer engagement systems.",
      icon: "🤖",
    },
    {
      title: "WhatsApp Automation",
      desc: "Automated WhatsApp lead capture, follow-ups, reminders, customer support, and sales pipelines.",
      icon: "💬",
    },
    {
      title: "Instagram Automation",
      desc: "AI captions, automated posting workflows, analytics dashboards, and social media automation systems.",
      icon: "📱",
    },
    {
      title: "CRM & Lead Pipelines",
      desc: "Connect ads, forms, emails, WhatsApp, and CRMs into one centralized automation ecosystem.",
      icon: "📊",
    },
    {
      title: "Custom AI Agents",
      desc: "Build intelligent AI assistants for sales, support, onboarding, content creation, and internal operations.",
      icon: "🧠",
    },
  ];

  const testimonials = [
    {
      name: "Digital Marketing Agency",
      feedback:
        "Xredible automated our lead management system and saved us hours every day.",
    },
    {
      name: "Local Business Owner",
      feedback:
        "The WhatsApp automation setup dramatically improved customer response times.",
    },
    {
      name: "Content Creator",
      feedback:
        "AI workflow systems helped automate our content pipeline completely.",
    },
  ];

  const faqs = [
    {
      q: "What businesses can benefit from automation?",
      a: "Any business handling leads, content, customer support, or repetitive operations can benefit from automation systems.",
    },
    {
      q: "Do you provide custom AI solutions?",
      a: "Yes. We build custom AI agents, workflows, dashboards, and business automation systems.",
    },
    {
      q: "Can you integrate WhatsApp with my business?",
      a: "Absolutely. We build WhatsApp automation systems for sales, support, reminders, and lead generation.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white scroll-smooth">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-cyan-400 font-black text-xl">X</span>
            </div>

            <div>
              <div className="font-black text-xl tracking-wide">
                Xredible
              </div>

              <div className="text-xs text-cyan-400">
                AI Automation
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a
              href="#services"
              className="text-zinc-300 hover:text-cyan-400 transition"
            >
              Services
            </a>

            <a
              href="#pricing"
              className="text-zinc-300 hover:text-cyan-400 transition"
            >
              Pricing
            </a>

            <a
              href="#portfolio"
              className="text-zinc-300 hover:text-cyan-400 transition"
            >
              Projects
            </a>

            <a
              href="#faq"
              className="text-zinc-300 hover:text-cyan-400 transition"
            >
              FAQ
            </a>

            <a
              href="#contact"
              className="text-zinc-300 hover:text-cyan-400 transition"
            >
              Contact
            </a>
          </nav>

          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-5 py-3 text-sm font-semibold text-black"
          >
            WhatsApp Us
          </a>
        </div>
      </header>

      {/* WhatsApp Floating Button */}
      <a
        href={`https://wa.me/${whatsappNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 rounded-full bg-green-500 hover:bg-green-400 transition p-4 shadow-2xl shadow-green-500/30"
      >
        <span className="text-white font-bold">WA</span>
      </a>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20" />

        <div className="relative max-w-7xl mx-auto px-6 py-28 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300 mb-6">
                AI + Automation Agency
              </div>

              <h1 className="text-5xl lg:text-7xl font-black leading-tight">
                Automate Your Business With
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
                  {" "}
                  AI & n8n
                </span>
              </h1>

              <p className="mt-8 text-lg text-zinc-300 leading-relaxed max-w-xl">
                We build intelligent automation systems using AI agents, n8n,
                WhatsApp automation, CRM workflows, and scalable business
                systems that save time and increase revenue.
              </p>

              <div className="flex flex-wrap gap-4 mt-10">
                <a
                  href={calendlyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 font-semibold text-black shadow-2xl shadow-cyan-500/20"
                >
                  Book Free Consultation
                </a>

                <a
                  href="#services"
                  className="rounded-2xl border border-white/20 hover:border-cyan-400/40 hover:bg-white/5 transition px-8 py-4 font-semibold"
                >
                  Explore Services
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                  <div className="text-cyan-400 text-3xl font-bold">
                    24/7
                  </div>
                  <div className="text-zinc-400 mt-2">
                    Automation Running
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                  <div className="text-cyan-400 text-3xl font-bold">
                    80%+
                  </div>
                  <div className="text-zinc-400 mt-2">Time Saved</div>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                  <div className="text-cyan-400 text-3xl font-bold">AI</div>
                  <div className="text-zinc-400 mt-2">Smart Workflows</div>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                  <div className="text-cyan-400 text-3xl font-bold">n8n</div>
                  <div className="text-zinc-400 mt-2">
                    Custom Integrations
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section
        id="services"
        className="max-w-7xl mx-auto px-6 py-24"
      >
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Automation Services
          </h2>

          <p className="mt-6 text-zinc-400 text-lg">
            End-to-end automation systems for businesses looking to scale
            smarter using AI and workflow automation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          {services.map((service, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-cyan-400/30 hover:-translate-y-1 transition duration-300"
            >
              <div className="text-4xl mb-5">{service.icon}</div>

              <h3 className="text-2xl font-semibold mb-4 text-cyan-300">
                {service.title}
              </h3>

              <p className="text-zinc-400 leading-relaxed">
                {service.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-t border-white/10 border-b border-white/10 bg-white/5"
      >
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Automation Packages
            </h2>

            <p className="mt-6 text-zinc-400 text-lg">
              Scalable AI automation systems built for modern businesses.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mt-16">
            <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
              <h3 className="text-3xl font-bold">
                Starter Automation
              </h3>

              <div className="text-5xl font-black mt-6 text-cyan-400">
                ₹9,999
              </div>

              <ul className="space-y-4 mt-10 text-zinc-300">
                <li>✔ Lead Capture Automation</li>
                <li>✔ CRM Setup</li>
                <li>✔ WhatsApp Alerts</li>
                <li>✔ Basic Workflows</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
              <div className="inline-block rounded-full bg-cyan-400 text-black text-xs font-bold px-4 py-2 mb-4">
                MOST POPULAR
              </div>

              <h3 className="text-3xl font-bold">
                Growth Automation
              </h3>

              <div className="text-5xl font-black mt-6 text-cyan-400">
                ₹24,999
              </div>

              <ul className="space-y-4 mt-10 text-zinc-300">
                <li>✔ AI Workflow Systems</li>
                <li>✔ n8n Automation</li>
                <li>✔ AI Content Systems</li>
                <li>✔ CRM Pipelines</li>
                <li>✔ WhatsApp Automation</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
              <h3 className="text-3xl font-bold">
                AI Business System
              </h3>

              <div className="text-5xl font-black mt-6 text-cyan-400">
                Custom
              </div>

              <ul className="space-y-4 mt-10 text-zinc-300">
                <li>✔ Full Automation Stack</li>
                <li>✔ AI Agents</li>
                <li>✔ Dashboards</li>
                <li>✔ Advanced Integrations</li>
                <li>✔ Ongoing Optimization</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section
        id="portfolio"
        className="max-w-7xl mx-auto px-6 py-24"
      >
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Automation Projects
          </h2>

          <p className="mt-6 text-zinc-400 text-lg">
            Smart systems designed to increase efficiency and automate
            business operations.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="text-2xl font-bold text-cyan-300">
              WhatsApp Lead Automation
            </h3>

            <p className="mt-4 text-zinc-400">
              Automated lead capture and instant notifications for
              faster customer response times.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="text-2xl font-bold text-cyan-300">
              AI Content Workflow
            </h3>

            <p className="mt-4 text-zinc-400">
              AI-powered content generation and automated publishing
              systems.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="text-2xl font-bold text-cyan-300">
              CRM Pipeline Automation
            </h3>

            <p className="mt-4 text-zinc-400">
              Centralized automation system connecting forms, email,
              sheets, and notifications.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-white/10 border-b border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Client Feedback
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {testimonials.map((item, i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-black/40 p-8"
              >
                <p className="text-zinc-300 leading-relaxed">
                  "{item.feedback}"
                </p>

                <div className="mt-6 text-cyan-400 font-semibold">
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="max-w-5xl mx-auto px-6 py-24"
      >
        <div className="text-center">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-6 mt-16">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-white/5 p-8"
            >
              <h3 className="text-xl font-semibold text-cyan-300">
                {faq.q}
              </h3>

              <p className="mt-4 text-zinc-400 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Form */}
      <section
        id="contact"
        className="max-w-4xl mx-auto px-6 py-24"
      >
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold">
              Let’s Build Your Automation System
            </h2>

            <p className="text-zinc-400 mt-4">
              Fill out the form below and we’ll contact you regarding
              your automation requirements.
            </p>
          </div>

          <form
            className="grid md:grid-cols-2 gap-6 mt-10"
            onSubmit={async (e) => {
              e.preventDefault();

              const formData = new FormData(e.currentTarget);

              const data = {
                name: formData.get("name"),
                email: formData.get("email"),
                business: formData.get("business"),
                whatsapp: formData.get("whatsapp"),
                message: formData.get("message"),
              };

              try {
                await fetch(
                  "https://n8n.xredible.in/webhook/contact-form",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                  }
                );

                alert("Inquiry submitted successfully!");
              } catch (error) {
                console.error(error);

                alert(
                  "Your inquiry was received. We'll contact you soon."
                );
              }
            }}
          >
            <input
              name="name"
              type="text"
              placeholder="Your Name"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
              required
            />

            <input
              name="email"
              type="email"
              placeholder="Your Email"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
              required
            />

            <input
              name="business"
              type="text"
              placeholder="Business Name"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <input
              name="whatsapp"
              type="text"
              placeholder="WhatsApp Number"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <textarea
              name="message"
              placeholder="Tell us what you want to automate"
              rows={5}
              className="md:col-span-2 rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
              required
            />

            <button
              type="submit"
              className="md:col-span-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 font-semibold text-black"
            >
              Submit Inquiry
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/80">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-2xl font-black">
              Xredible
            </div>

            <div className="text-zinc-500 mt-2">
              AI Automation Systems for Modern Businesses
            </div>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <a href="#services" className="hover:text-cyan-400">
              Services
            </a>

            <a href="#pricing" className="hover:text-cyan-400">
              Pricing
            </a>

            <a href="#portfolio" className="hover:text-cyan-400">
              Projects
            </a>

            <a href="#contact" className="hover:text-cyan-400">
              Contact
            </a>
          </div>
        </div>
      </footer>

      {/* Tawk.to Live Chat */}
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `
            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/6a1324055568261c36f51b35/1jpdc9dsq';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
            })();
          `,
        }}
      />
    </div>
  );
}