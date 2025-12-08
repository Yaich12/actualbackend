import React from "react"

import "./livingPlusDemo.css"

const cards = [
  {
    title: "Activity",
    metric: "375 cal",
    sub: "Move",
    detail: "19 min exercise",
    accent: "accent-orange",
  },
  {
    title: "AI Assistant",
    metric: "Next patient 09:30",
    sub: "Maria J.",
    detail: "Start med gait analysis",
    accent: "accent-blue",
  },
  {
    title: "Client Satisfaction",
    metric: "92%",
    sub: "Top-tier",
    detail: "5 feedbacks i går",
    accent: "accent-sage",
  },
  {
    title: "Revenue Pulse",
    metric: "+18%",
    sub: "Månedlig vækst",
    detail: "Faktureret 48.200 kr.",
    accent: "accent-rose",
  },
  {
    title: "Sleep",
    metric: "7t 20m",
    sub: "Time asleep",
    detail: "Deep sleep 2t",
    accent: "accent-lilac",
  },
  {
    title: "State of Mind",
    metric: "Pleasant",
    sub: "Calm & focused",
    detail: "3 noter fra i dag",
    accent: "accent-gold",
  },
]

const LivingPlusDemo = () => (
  <div className="living-apple-shell">
    <aside className="living-sidebar">
      <h3>Living Plus</h3>
      <input className="living-search" placeholder="Search" aria-label="Search" />
      <nav>
        <p className="active">Summary</p>
        <p>Freedom Journey</p>
        <p>AI Messages</p>
        <p>Client Files</p>
        <p>Settings</p>
      </nav>
      <div className="living-sidebar-footer">
        <p>Version 2.0</p>
      </div>
    </aside>

    <main className="living-main">
      <header className="living-topbar">
        <div>
          <p className="living-pill">Dashboard</p>
          <h2>Good morning, Dr. Hansen</h2>
          <p className="living-subtitle">Du har 5 patienter i dag. Alt er forberedt.</p>
        </div>
        <div className="living-journey" aria-label="Business Freedom progress">
          <p>Business Freedom</p>
          <div className="journey-track">
            <div className="journey-fill" />
          </div>
          <span>75% complete</span>
        </div>
      </header>

      <section className="living-grid" aria-label="Dashboard summary cards">
        {cards.map((card) => (
          <article key={card.title} className={`living-card ${card.accent}`}>
            <p className="living-card-label">{card.title}</p>
            <h3>{card.metric}</h3>
            <p className="living-card-sub">{card.sub}</p>
            <p className="living-card-detail">{card.detail}</p>
          </article>
        ))}
      </section>
    </main>
  </div>
)

export default LivingPlusDemo

