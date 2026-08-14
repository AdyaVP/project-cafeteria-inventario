export const BUSINESS_TIME_ZONE = 'America/Tegucigalpa'

export function getBusinessDateISO(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
