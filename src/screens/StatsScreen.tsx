// Statistiques de base (SPEC §11).
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { State } from 'ts-fsrs';
import { db } from '../db/db';
import { CARD_TYPE_LABELS, type CardType } from '../db/model';
import { today } from '../session/sessionService';
import { getSettings } from '../settings';
import { addDays, dayEnd } from '../srs/studyDay';

export function StatsScreen() {
  const data = useLiveQuery(async () => {
    const since = addDays(today(), -29);
    const [cards, logs, days] = await Promise.all([
      db.cards.toArray(),
      db.reviewLogs.where('day').aboveOrEqual(since).toArray(),
      db.days.where('day').aboveOrEqual(since).toArray(),
    ]);
    return { cards, logs, days, since };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const cutoff = getSettings().dayCutoffHour;
    const day = today();
    const byState = { new: 0, learning: 0, review: 0 };
    for (const c of data.cards) {
      if (c.fsrs.state === State.New) byState.new++;
      else if (c.fsrs.state === State.Review) byState.review++;
      else byState.learning++;
    }

    // Révisions et minutes des 30 derniers jours
    const daysMap = new Map(data.days.map((d) => [d.day, d]));
    const last30 = Array.from({ length: 30 }, (_, i) => addDays(data.since, i)).map((d) => ({
      day: d,
      reviews: daysMap.get(d)?.reviews ?? 0,
      minutes: Math.round((daysMap.get(d)?.activeMs ?? 0) / 60000),
    }));

    // Réussite par type (note > Raté)
    const byType = new Map<CardType, { total: number; ok: number; corrected: number; auto: number }>();
    for (const l of data.logs) {
      const t = byType.get(l.type) ?? { total: 0, ok: 0, corrected: 0, auto: 0 };
      t.total++;
      if (l.rating > 1) t.ok++;
      if (l.autoRating) {
        t.auto++;
        if (l.autoRating !== l.rating) t.corrected++;
      }
      byType.set(l.type, t);
    }

    // Prévision : cartes dues chacun des 7 prochains jours
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(day, i);
      const end = dayEnd(d, cutoff);
      const start = i === 0 ? new Date(0) : dayEnd(addDays(d, -1), cutoff);
      return {
        day: d,
        count: data.cards.filter((c) => c.fsrs.state !== State.New && c.due >= start && c.due < end).length,
      };
    });

    const leeches = data.cards.filter((c) => c.fsrs.lapses >= 6).length;
    return { byState, last30, byType, forecast, leeches, totalMinutes: last30.reduce((s, d) => s + d.minutes, 0) };
  }, [data]);

  if (!stats) return null;
  const maxReviews = Math.max(1, ...stats.last30.map((d) => d.reviews));
  const maxForecast = Math.max(1, ...stats.forecast.map((d) => d.count));
  const weekday = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('fr', { weekday: 'short' });

  return (
    <div className="screen narrow">
      <p>
        <Link to="/">← Accueil</Link>
      </p>
      <h1>Statistiques</h1>

      <section>
        <h2>Cartes</h2>
        <div className="rating-counts three">
          <div>
            <strong>{stats.byState.review}</strong>
            <span className="muted">en révision</span>
          </div>
          <div>
            <strong>{stats.byState.learning}</strong>
            <span className="muted">en apprentissage</span>
          </div>
          <div>
            <strong>{stats.byState.new}</strong>
            <span className="muted">pas encore vues</span>
          </div>
        </div>
      </section>

      <section>
        <h2>30 derniers jours · {stats.totalMinutes} min</h2>
        <div className="bars" role="img" aria-label="Révisions par jour">
          {stats.last30.map((d) => (
            <span
              key={d.day}
              className="bar"
              style={{ height: `${(d.reviews / maxReviews) * 100}%` }}
              title={`${d.day} : ${d.reviews} révisions, ${d.minutes} min`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Réussite par type de carte (30 jours)</h2>
        {stats.byType.size === 0 ? (
          <p className="muted">Pas encore de révision.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Révisions</th>
                <th>Réussite</th>
                <th>Notes corrigées</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.byType].map(([type, t]) => (
                <tr key={type}>
                  <td>{CARD_TYPE_LABELS[type]}</td>
                  <td>{t.total}</td>
                  <td>{Math.round((t.ok / t.total) * 100)} %</td>
                  <td>{t.auto ? `${Math.round((t.corrected / t.auto) * 100)} %` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Prévision sur 7 jours</h2>
        <div className="forecast">
          {stats.forecast.map((d, i) => (
            <div key={d.day} className="forecast-day">
              <span className="bar-wrap">
                <span className="bar" style={{ height: `${(d.count / maxForecast) * 100}%` }} />
              </span>
              <strong>{d.count}</strong>
              <span className="muted small">{i === 0 ? "auj." : weekday(d.day)}</span>
            </div>
          ))}
        </div>
      </section>

      {stats.leeches > 0 && (
        <p className="callout subtle">
          {stats.leeches} carte{stats.leeches > 1 ? 's' : ''} ratée{stats.leeches > 1 ? 's' : ''} 6 fois ou plus : elles
          mériteraient une mnémotechnique.
        </p>
      )}
    </div>
  );
}
