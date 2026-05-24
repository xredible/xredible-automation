export default function XredibleAutomationWebsite() {
  const whatsappNumber = "918085946384";
  const calendlyLink = "https://wa.me/918085946384";

  const services = [
    {
      title: "n8n Workflow Automation",
      desc: "Custom workflows that automate repetitive business tasks, lead management, notifications, CRM updates, reporting, and more.",
    },
    {
      title: "AI Marketing Automation",
      desc: "AI-powered systems for content generation, lead nurturing, social media automation, and campaign optimization.",
    },
    {
      title: "WhatsApp Automation",
      desc: "Automated customer support, lead follow-ups, appointment reminders, and broadcast workflows using WhatsApp integrations.",
    },
    {
      title: "Instagram & Social Media Systems",
      desc: "Automated posting, analytics dashboards, AI captions, hashtag generation, and content scheduling.",
    },
    {
      title: "CRM & Lead Pipelines",
      desc: "Connect forms, ads, email, WhatsApp, and CRMs into one automated lead management ecosystem.",
    },
    {
      title: "Custom AI Agents",
      desc: "Build intelligent AI assistants for customer support, sales qualification, content creation, and internal business operations.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white scroll-smooth">
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-cyan-500/20" />

        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-36">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
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
                We build intelligent automation systems for businesses using
                n8n, AI agents, WhatsApp automation, and custom workflows that
                save time and increase revenue.
              </p>

              <div className="flex flex-wrap gap-4 mt-10">
                <a
                  href={calendlyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 font-semibold text-black"
                >
                  Book Free Consultation
                </a>

                <a
                  href="#contact"
                  className="rounded-2xl border border-white/20 hover:border-cyan-400/40 hover:bg-white/5 transition px-8 py-4 font-semibold"
                >
                  Contact Us
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
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Automation Services
          </h2>

          <p className="mt-6 text-zinc-400 text-lg">
            End-to-end automation systems for marketing, sales, operations,
            customer support, and content workflows.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {services.map((service, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-white/5 p-8"
            >
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
              Fill out the form below and we’ll contact you regarding your
              automation requirements.
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
                alert("Something went wrong.");
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
    </div>
  );
}