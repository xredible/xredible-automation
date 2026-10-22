// lib/autopilot/moments.ts
//
// Festivals and days Indian audiences post about. Dates are for India; some festivals follow the moon
// and can differ by a day in some regions (Eid depends on the moon sighting).

export type Moment = { id: string; date: string; name: string; idea: string; kind: "festival" | "national" | "day" | "christian" }

const M: [string, string, Moment["kind"], string][] = [
  ["2026-11-08", "Diwali", "festival", "light, new beginnings, family, thanking customers, festive offers"],
  ["2026-11-14", "Children's Day", "day", "childhood, learning, the next generation"],
  ["2026-11-15", "Chhath Puja", "festival", "gratitude, devotion, family traditions"],
  ["2026-11-24", "Guru Nanak Jayanti", "festival", "service, equality, kindness"],
  ["2026-12-25", "Christmas", "christian", "joy, giving, hope, year-end gratitude"],
  ["2026-12-31", "New Year's Eve", "day", "looking back on the year, thank-yous, plans for next year"],
  ["2027-01-01", "New Year", "day", "fresh starts, goals, resolutions"],
  ["2027-01-13", "Lohri", "festival", "harvest, warmth, celebration"],
  ["2027-01-15", "Makar Sankranti / Pongal", "festival", "harvest, kites, new season, gratitude"],
  ["2027-01-26", "Republic Day", "national", "pride, the Constitution, building India"],
  ["2027-02-11", "Vasant Panchami", "festival", "learning, knowledge, spring"],
  ["2027-02-14", "Valentine's Day", "day", "love, care, appreciation"],
  ["2027-03-06", "Maha Shivaratri", "festival", "devotion, reflection"],
  ["2027-03-08", "International Women's Day", "day", "women who inspire, equality, celebrating women in your work"],
  ["2027-03-10", "Eid ul-Fitr (depends on the moon)", "festival", "togetherness, sharing, Eid Mubarak wishes"],
  ["2027-03-22", "Holi", "festival", "colours, joy, letting go, fun"],
  ["2027-03-26", "Good Friday", "christian", "sacrifice, reflection, quiet respect (not a celebration)"],
  ["2027-03-28", "Easter", "christian", "hope, new life, celebration"],
  ["2027-04-07", "Ugadi / Gudi Padwa", "festival", "new year, new beginnings"],
  ["2027-04-15", "Ram Navami", "festival", "values, righteousness"],
  ["2027-04-18", "Mahavir Jayanti", "festival", "non-violence, compassion"],
  ["2027-04-22", "Earth Day", "day", "sustainability, small green habits"],
  ["2027-05-09", "Mother's Day", "day", "mothers, care, gratitude"],
  ["2027-05-17", "Eid al-Adha (Bakrid)", "festival", "sacrifice, sharing, Eid wishes"],
  ["2027-06-16", "Muharram", "festival", "respect, reflection (not a celebration)"],
  ["2027-06-20", "Father's Day", "day", "fathers, lessons, gratitude"],
  ["2027-06-21", "International Yoga Day", "day", "health, balance, wellbeing"],
  ["2027-07-01", "National Doctors' Day", "day", "thanking doctors, health"],
  ["2027-08-15", "Independence Day", "national", "freedom, pride, progress"],
  ["2027-08-17", "Raksha Bandhan", "festival", "siblings, protection, bonds"],
  ["2027-08-25", "Janmashtami", "festival", "joy, wisdom, devotion"],
  ["2027-09-04", "Ganesh Chaturthi", "festival", "new beginnings, removing obstacles"],
  ["2027-09-05", "Teachers' Day", "day", "teachers and mentors, lessons learnt"],
  ["2027-09-12", "Onam", "festival", "harvest, togetherness, Kerala traditions"],
  ["2027-09-30", "Navratri begins", "festival", "nine days of celebration, energy, devotion"],
  ["2027-10-02", "Gandhi Jayanti", "national", "truth, simplicity, non-violence"],
  ["2027-10-09", "Dussehra", "festival", "good over evil, overcoming challenges"],
  ["2027-10-18", "Karwa Chauth", "festival", "love, commitment"],
  ["2027-10-29", "Diwali", "festival", "light, new beginnings, family, thanking customers, festive offers"],
  ["2027-10-31", "Bhai Dooj", "festival", "siblings, family"],
  ["2027-11-04", "Chhath Puja", "festival", "gratitude, devotion, family traditions"],
  ["2027-11-14", "Guru Nanak Jayanti / Children's Day", "festival", "service, kindness, children"],
  ["2027-12-25", "Christmas", "christian", "joy, giving, hope, year-end gratitude"],
]

export const MOMENTS: Moment[] = M.map(([date, name, kind, idea]) => ({ id: `${date}-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`, date, name, kind, idea }))

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)

/** Moments from today to `days` ahead. */
export function momentsAhead(days = 75): (Moment & { inDays: number })[] {
  const today = istToday()
  const t0 = Date.parse(today)
  return MOMENTS.filter((m) => m.date >= today)
    .map((m) => ({ ...m, inDays: Math.round((Date.parse(m.date) - t0) / 864e5) }))
    .filter((m) => m.inDays <= days)
}

export const momentById = (id: string) => MOMENTS.find((m) => m.id === id) || null
