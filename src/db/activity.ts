// Activité quotidienne, comptée par appareil puis additionnée (PC + téléphone le même jour).
import { db } from './db';
import { deviceId } from './device';
import { sumDevices } from '../sync/merge';
import type { DayActivity } from './model';

export interface DayDelta {
  activeMs?: number;
  reviews?: number;
  newItems?: number;
  expressDone?: boolean;
}

/** Ajoute de l'activité à une journée pour cet appareil. À appeler dans une transaction incluant `db.days`. */
export async function bumpDay(day: string, delta: DayDelta): Promise<void> {
  const current: DayActivity = (await db.days.get(day)) ?? { day, activeMs: 0, reviews: 0, newItems: 0 };
  const device = deviceId();
  // Journée créée avant le suivi par appareil : son activité est attribuée à cet appareil
  const devices = {
    ...(current.devices ?? { [device]: { activeMs: current.activeMs, reviews: current.reviews, newItems: current.newItems } }),
  };
  const mine = devices[device] ?? { activeMs: 0, reviews: 0, newItems: 0 };
  devices[device] = {
    activeMs: mine.activeMs + (delta.activeMs ?? 0),
    reviews: mine.reviews + (delta.reviews ?? 0),
    newItems: mine.newItems + (delta.newItems ?? 0),
  };
  await db.days.put({
    day,
    ...sumDevices(devices),
    devices,
    ...(current.expressDone || delta.expressDone ? { expressDone: true } : {}),
  });
}
