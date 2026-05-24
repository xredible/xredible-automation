export default function XredibleAutomationWebsite() {
  const whatsappNumber = "918085949384";
  const calendlyLink = "https://calendly.com/xredible";
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

  const plans = [
    {
      name: "Starter",
      price: "₹4,999/mo",
      features: [
        "2 Automation Workflows",
        "Basic Support",
        "Lead Notifications",
        "Weekly Monitoring",
      ],
    },
    {
      name: "Growth",
      price: "₹14,999/mo",
      features: [
        "10 Automation Workflows",
        "AI Marketing Automation",
        "WhatsApp Integration",
        "Priority Support",
      ],
    },
    {
      name: "Agency Pro",
      price: "Custom",
      features: [
        "Unlimited Workflows",
        "Dedicated AI Systems",
        "Advanced Integrations",
        "Full Business Automation",
      ],
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-8 h-8 text-white"
        >
          <path d="M12 2C6.477 2 2 6.253 2 11.5c0 1.85.565 3.57 1.53 5.03L2 22l5.73-1.49A10.24 10.24 0 0012 21c5.523 0 10-4.253 10-9.5S17.523 2 12 2zm5.3 13.2c-.22.61-1.28 1.16-1.76 1.23-.45.07-1.02.1-1.64-.1-.38-.12-.86-.28-1.49-.54-2.62-1.08-4.32-3.62-4.45-3.8-.13-.18-1.07-1.42-1.07-2.7 0-1.29.67-1.92.91-2.18.24-.26.52-.32.69-.32h.5c.16 0 .37-.06.58.45.22.52.73 1.79.8 1.92.06.13.1.28.02.46-.08.18-.12.29-.24.45-.12.16-.25.36-.36.48-.12.12-.25.26-.1.52.14.26.64 1.06 1.37 1.71.94.84 1.73 1.1 1.98 1.22.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.6-.16 1.2z" />
        </svg>
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
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text"> AI & n8n</span>
              </h1>

              <p className="mt-8 text-lg text-zinc-300 leading-relaxed max-w-xl">
                We build intelligent automation systems for businesses using n8n, AI agents, WhatsApp automation, social media systems, and custom workflows that save time and increase revenue.
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

                <button className="rounded-2xl border border-white/20 hover:border-cyan-400/40 hover:bg-white/5 transition px-8 py-4 font-semibold">
                  View Services
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                    <div className="text-cyan-400 text-3xl font-bold">24/7</div>
                    <div className="text-zinc-400 mt-2">Automation Running</div>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                    <div className="text-cyan-400 text-3xl font-bold">80%+</div>
                    <div className="text-zinc-400 mt-2">Time Saved</div>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                    <div className="text-cyan-400 text-3xl font-bold">AI</div>
                    <div className="text-zinc-400 mt-2">Smart Workflows</div>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-5 border border-white/10">
                    <div className="text-cyan-400 text-3xl font-bold">n8n</div>
                    <div className="text-zinc-400 mt-2">Custom Integrations</div>
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
            End-to-end automation systems for marketing, sales, operations, customer support, and content workflows.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {services.map((service, i) => (
            <div
              key={i}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-cyan-400/30 transition"
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

      {/* Pricing */}
      <section className="border-t border-white/10 border-b border-white/10 bg-white/5">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Subscription Plans
            </h2>
            <p className="mt-6 text-zinc-400 text-lg">
              Choose a monthly automation subscription for your business.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mt-16">
            {plans.map((plan, i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-xl"
              >
                <h3 className="text-3xl font-bold">{plan.name}</h3>
                <div className="text-5xl font-black mt-6 text-cyan-400">
                  {plan.price}
                </div>

                <ul className="space-y-4 mt-10">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-zinc-300">
                      <div className="h-2 w-2 rounded-full bg-cyan-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className="w-full mt-10 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-6 py-4 font-semibold text-black">
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
              Why Businesses Choose Xredible Automation
            </h2>

            <div className="space-y-6 mt-10">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-cyan-300">
                  Custom Automation Systems
                </h3>
                <p className="text-zinc-400 mt-3">
                  Every workflow is tailored specifically for your business goals and operations.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-cyan-300">
                  AI + Human Strategy
                </h3>
                <p className="text-zinc-400 mt-3">
                  Combine AI agents with strategic automation to scale marketing and operations efficiently.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-cyan-300">
                  Ongoing Subscription Support
                </h3>
                <p className="text-zinc-400 mt-3">
                  Monthly optimization, monitoring, troubleshooting, and improvements included.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-10">
            <div className="text-sm uppercase tracking-widest text-cyan-300">
              Built For Modern Businesses
            </div>

            <h3 className="text-4xl font-black mt-4 leading-tight">
              Save Time. Increase Revenue. Automate Everything.
            </h3>

            <p className="mt-6 text-zinc-300 leading-relaxed">
              From lead capture to AI-generated reports and WhatsApp follow-ups, we help businesses operate smarter using modern automation systems.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-10">
              <div className="rounded-2xl bg-black/30 p-5 border border-white/10">
                <div className="text-3xl font-bold text-cyan-400">100+</div>
                <div className="text-zinc-400 mt-2">Workflow Possibilities</div>
              </div>

              <div className="rounded-2xl bg-black/30 p-5 border border-white/10">
                <div className="text-3xl font-bold text-cyan-400">AI</div>
                <div className="text-zinc-400 mt-2">Integrated Systems</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h2 className="text-5xl font-black leading-tight">
            Ready To Automate Your Business?
          </h2>

          <p className="mt-6 text-zinc-400 text-lg max-w-2xl mx-auto">
            Let’s build automation systems that save hours every week and help your business scale faster.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <button className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 font-semibold text-black">
              Schedule Consultation
            </button>

            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-white/20 hover:border-cyan-400/40 hover:bg-white/5 transition px-8 py-4 font-semibold"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl">
          <div className="text-center">
            <h2 className="text-4xl font-bold">Let’s Build Your Automation System</h2>
            <p className="text-zinc-400 mt-4">
              Fill out the form below and we’ll contact you regarding your automation requirements.
            </p>
          </div>

          <form className="grid md:grid-cols-2 gap-6 mt-10">
            <input
              type="text"
              placeholder="Your Name"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <input
              type="email"
              placeholder="Your Email"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <input
              type="text"
              placeholder="Business Name"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <input
              type="text"
              placeholder="WhatsApp Number"
              className="rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <textarea
              placeholder="Tell us what you want to automate"
              rows={5}
              className="md:col-span-2 rounded-2xl bg-black/40 border border-white/10 px-5 py-4 outline-none"
            />

            <button className="md:col-span-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 font-semibold text-black">
              Submit Inquiry
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

