// Identifiant de cet appareil (navigateur), pour compter l'activité de chaque appareil séparément.
const KEY = 'polychinese.deviceId';

let fallback: string | undefined;

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Stockage indisponible : identifiant valable pour cette session
    return (fallback ??= crypto.randomUUID());
  }
}
