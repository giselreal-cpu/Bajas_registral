// Horas hábiles (lunes a viernes) transcurridas entre dos fechas. Es una
// aproximación: suma hora por hora solo las que caen en día de semana, sin
// calendario de feriados (no hace falta precisión de RRHH para esto, solo
// saber si ya pasaron ~48hs hábiles para recordar reenviar una encuesta).
export function horasHabilesTranscurridas(desde: string | Date, hasta: string | Date): number {
  const inicio = new Date(desde);
  const fin = new Date(hasta);
  if (fin <= inicio) return 0;

  let horas = 0;
  const cursor = new Date(inicio);
  cursor.setMinutes(0, 0, 0);
  while (cursor < fin) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      horas++;
    }
    cursor.setHours(cursor.getHours() + 1);
  }
  return horas;
}
