import prisma from '../prisma/client.js'

const INCOMPLETE_STATUSES = ['WAITING', 'IN_PROGRESS', 'ASSEMBLED', 'POSTPONED']

export async function runAutoPostpone() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  console.log(`[auto-postpone] Проверяем за ${yesterday.toLocaleDateString('ru')}`)

  const incomplete = await prisma.planRow.findMany({
    where: {
      plan: { planDate: yesterday },
      status: { in: INCOMPLETE_STATUSES },
    }
  })

  if (incomplete.length === 0) {
    console.log('[auto-postpone] Незавершённых нет')
    return
  }

  console.log(`[auto-postpone] Переносим ${incomplete.length} записей`)

  let todayPlan = await prisma.plan.findUnique({ where: { planDate: today } })
  if (!todayPlan) {
    todayPlan = await prisma.plan.create({ data: { planDate: today } })
  }

  const lastRow = await prisma.planRow.findFirst({
    where: { planId: todayPlan.id },
    orderBy: { sortOrder: 'desc' }
  })
  let sortOrder = (lastRow?.sortOrder ?? -1) + 1

  for (const row of incomplete) {
    await prisma.planRow.update({
      where: { id: row.id },
      data: {
        planId:      todayPlan.id,
        sortOrder:   sortOrder++,
        isPostponed: true,
        originalDate: row.originalDate ?? yesterday,
      }
    })
  }

  console.log(`[auto-postpone] Done: ${incomplete.length}`)
}

export function startAutoPostponeScheduler() {
  console.log('[auto-postpone] Планировщик запущен — срабатывает в 00:01')
  const scheduleNext = () => {
    const now = new Date()
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 1, 0, 0)
    const ms = next.getTime() - now.getTime()
    console.log(`[auto-postpone] Следующий запуск через ${Math.round(ms / 60000)} мин`)
    setTimeout(async () => {
      await runAutoPostpone().catch(e => console.error('[auto-postpone]', e.message))
      scheduleNext()
    }, ms)
  }
  scheduleNext()
}
