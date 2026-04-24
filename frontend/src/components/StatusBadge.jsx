// Конфигурация статусов: цвет, метка, для каких типов строк доступен
export const STATUS_CONFIG = {
  WAITING:     { label: 'Ожидание',  color: 'bg-gray-100 text-gray-600',      dot: 'bg-gray-400' },
  POSTPONED:   { label: 'Перенос',   color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500' },
  ACCEPTED:    { label: 'Принят',    color: 'bg-green-100 text-green-700',    dot: 'bg-green-500' },
  IN_PROGRESS: { label: 'В работе',  color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500' },
  ASSEMBLED:   { label: 'Собран',    color: 'bg-purple-100 text-purple-700',  dot: 'bg-purple-500' },
  SHIPPED:     { label: 'Отгружен',  color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  CANCELLED:   { label: 'Отменён',   color: 'bg-red-100 text-red-700',        dot: 'bg-red-500' },
}

export const ROW_TYPE_CONFIG = {
  ARRIVAL:   { label: 'Поступление', short: 'П',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
  CONTAINER: { label: 'Контейнер',   short: 'К',  color: 'bg-violet-100 text-violet-700 border-violet-200' },
  DELIVERY:  { label: 'Доставка',    short: 'Д',  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  PICKUP:    { label: 'Самовывоз',   short: 'С',  color: 'bg-teal-100 text-teal-700 border-teal-200' },
  RETURN:    { label: 'Возврат',     short: 'В',  color: 'bg-red-100 text-red-700 border-red-200' },
}

export const ROLE_LABELS = {
  SUPER:     'Суперпользователь',
  WAREHOUSE: 'Кладовщик',
  LOADER:    'Грузчик',
  RECEIVER:  'Приёмщик',
  VIEWER:    'Просмотр',
  MANAGER:   'Менеджер',
}

// Какие статусы может выставлять каждая роль, для каждого типа строки
export const ALLOWED_STATUS_TRANSITIONS = {
  SUPER: {
    ARRIVAL:   ['WAITING', 'POSTPONED', 'ACCEPTED', 'CANCELLED'],
    CONTAINER: ['WAITING', 'IN_PROGRESS', 'ASSEMBLED', 'POSTPONED', 'SHIPPED', 'CANCELLED'],
    DELIVERY:  ['WAITING', 'IN_PROGRESS', 'ASSEMBLED', 'POSTPONED', 'SHIPPED', 'CANCELLED'],
    PICKUP:    ['WAITING', 'IN_PROGRESS', 'ASSEMBLED', 'POSTPONED', 'SHIPPED', 'CANCELLED'],
    RETURN:    ['WAITING', 'POSTPONED', 'ACCEPTED', 'CANCELLED'],
  },
  RECEIVER: {
    ARRIVAL: ['WAITING', 'POSTPONED', 'ACCEPTED'],
    RETURN:  ['WAITING', 'POSTPONED', 'ACCEPTED'],
  },
  WAREHOUSE: {
    CONTAINER: ['IN_PROGRESS', 'ASSEMBLED'],
    DELIVERY:  ['IN_PROGRESS', 'ASSEMBLED'],
    PICKUP:    ['IN_PROGRESS', 'ASSEMBLED'],
  },
  LOADER: {
    CONTAINER: ['SHIPPED'],
    DELIVERY:  ['SHIPPED'],
    PICKUP:    ['SHIPPED'],
  },
  MANAGER: {
    ARRIVAL:   ['WAITING', 'POSTPONED', 'CANCELLED'],
    CONTAINER: ['WAITING', 'POSTPONED', 'CANCELLED'],
    DELIVERY:  ['WAITING', 'POSTPONED', 'CANCELLED'],
    PICKUP:    ['WAITING', 'POSTPONED', 'CANCELLED'],
    RETURN:    ['WAITING', 'POSTPONED', 'CANCELLED'],
  },
  VIEWER: {},
}

export function StatusBadge({ status, size = 'md' }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cfg.color} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export function RowTypeBadge({ type, rawType }) {
  const cfg = ROW_TYPE_CONFIG[type] || ROW_TYPE_CONFIG.ARRIVAL
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border ${cfg.color}`}>
      {rawType || cfg.short}
    </span>
  )
}
// MANAGER добавлен
