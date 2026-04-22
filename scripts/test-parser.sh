#!/bin/bash
# =============================================================
# Тест парсера Excel — запускай после этапа 1
# Проверяет что файл правильно читается
# Запускай: bash scripts/test-parser.sh path/to/file.xls
# =============================================================
set -e

FILE=${1:-""}

if [ -z "$FILE" ]; then
  echo "Укажи путь к файлу: bash scripts/test-parser.sh файл.xls"
  exit 1
fi

cd backend

node --input-type=module << JSEOF
import { readFile } from 'fs/promises'
import { parseExcelPlan } from './src/services/excelParser.js'

const buffer = await readFile('${FILE}')
const result = await parseExcelPlan(buffer, '${FILE}')

console.log('✓ Дата плана:', result.planDate.toLocaleDateString('ru'))
console.log('✓ Строк найдено:', result.rows.length)
console.log('')
console.log('Первые 5 строк:')
result.rows.slice(0, 5).forEach((r, i) => {
  console.log(\`  \${i+1}. [\${r.rawType}→\${r.rowType}] \${r.counterparty || '(пусто)'} | вес: \${r.weight} | менеджер: \${r.manager}\`)
})

console.log('')
console.log('Итого по типам:')
const counts = {}
result.rows.forEach(r => counts[r.rowType] = (counts[r.rowType] || 0) + 1)
Object.entries(counts).forEach(([t, n]) => console.log(\`  \${t}: \${n}\`))
JSEOF
