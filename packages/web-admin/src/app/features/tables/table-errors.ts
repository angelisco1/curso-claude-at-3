const MESSAGES: Record<string, string> = {
  DuplicatedTableNumberError: 'Ya existe una mesa con ese número en este restaurante.',
  TableOccupiedError: 'No se puede eliminar una mesa ocupada. Libérala primero.',
  InvalidTableNumberError: 'El número de mesa debe ser un entero mayor o igual que 1.',
  InvalidTableCapacityError: 'La capacidad debe ser un entero mayor o igual que 1.',
  InvalidTableStatusError: 'El estado de la mesa no es válido.',
  TableNotFoundError: 'La mesa no existe.',
}

/** Traduce un error HTTP de la API de mesas a un mensaje en español, según `error.error.error`. */
export function tableErrorMessage(err: any, fallback: string): string {
  if (err?.status === 403) return 'No tienes permiso para realizar esta acción.'
  const name: string | undefined = err?.error?.error
  if (name && MESSAGES[name]) return MESSAGES[name]
  return err?.error?.message ?? fallback
}
