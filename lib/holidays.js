/**
 * Ontario public holidays, worked out for any year.
 *
 * These are calculated rather than typed out year by year, so the calendar
 * keeps working forever without anyone maintaining a list. No internet
 * connection, no API key, nothing to expire.
 *
 * `stat: true` marks the statutory holidays — the days most people
 * actually get off. The rest are days worth seeing on a calendar.
 */

const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** The nth given weekday of a month. weekday: 0 = Sunday. */
function nthWeekday(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1).getDay()
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  return iso(year, month, day)
}

/** The last given weekday on or before a date. */
function weekdayOnOrBefore(year, month, day, weekday) {
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7))
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Easter Sunday — the anonymous Gregorian algorithm. */
function easter(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function shiftDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function holidaysFor(year) {
  const easterSunday = easter(year)

  return [
    { date: iso(year, 1, 1),                          name: "New Year's Day",   stat: true },
    { date: iso(year, 2, 14),                         name: "Valentine's Day",  stat: false },
    { date: nthWeekday(year, 2, 1, 3),                name: 'Family Day',       stat: true },
    { date: shiftDays(easterSunday, -2),              name: 'Good Friday',      stat: true },
    { date: iso(easterSunday.getFullYear(), easterSunday.getMonth() + 1, easterSunday.getDate()),
                                                      name: 'Easter Sunday',    stat: false },
    { date: shiftDays(easterSunday, 1),               name: 'Easter Monday',    stat: false },
    { date: nthWeekday(year, 5, 0, 2),                name: "Mother's Day",     stat: false },
    { date: weekdayOnOrBefore(year, 5, 24, 1),        name: 'Victoria Day',     stat: true },
    { date: nthWeekday(year, 6, 0, 3),                name: "Father's Day",     stat: false },
    { date: iso(year, 7, 1),                          name: 'Canada Day',       stat: true },
    { date: nthWeekday(year, 8, 1, 1),                name: 'Civic Holiday',    stat: true },
    { date: nthWeekday(year, 9, 1, 1),                name: 'Labour Day',       stat: true },
    { date: iso(year, 9, 30),                         name: 'Truth and Reconciliation Day', stat: false },
    { date: nthWeekday(year, 10, 1, 2),               name: 'Thanksgiving',     stat: true },
    { date: iso(year, 10, 31),                        name: 'Halloween',        stat: false },
    { date: iso(year, 11, 11),                        name: 'Remembrance Day',  stat: false },
    { date: iso(year, 12, 25),                        name: 'Christmas Day',    stat: true },
    { date: iso(year, 12, 26),                        name: 'Boxing Day',       stat: true },
  ]
}

/** Every holiday in a window of years, keyed by date. */
export function holidayMap(years) {
  const map = {}
  years.forEach((y) => {
    holidaysFor(y).forEach((h) => {
      map[h.date] = map[h.date] ?? []
      map[h.date].push(h)
    })
  })
  return map
}
