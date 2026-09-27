import { TOLERANCE_LABELS, detectedPointer, updateSettings, useSettings, type ToleranceMode } from '../settings';

export function ToleranceSelect() {
  const { tolerance } = useSettings();
  const detected = detectedPointer() === 'mouse' ? 'souris' : 'doigt';
  return (
    <label className="field">
      <span>Tolérance du tracé</span>
      <select value={tolerance} onChange={(e) => updateSettings({ tolerance: e.target.value as ToleranceMode })}>
        {(Object.keys(TOLERANCE_LABELS) as ToleranceMode[]).map((m) => (
          <option key={m} value={m}>
            {m === 'auto' ? `Automatique (${detected} détecté)` : TOLERANCE_LABELS[m]}
          </option>
        ))}
      </select>
    </label>
  );
}
