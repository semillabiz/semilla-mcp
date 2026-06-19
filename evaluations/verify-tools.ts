/**
 * verify-tools.ts — chequeo de cumplimiento del MCP Directory de Anthropic.
 *
 * Verifica, sobre TODAS las tools registradas, que:
 *   1. Cada tool tiene `annotations.title` (string no vacío).         [requisito duro de Anthropic]
 *   2. Cada tool declara `readOnlyHint` o `destructiveHint`.           [requisito duro de Anthropic]
 *   3. No hay nombres de tool duplicados.
 *   4. Cada tool tiene su `case` en el dispatcher de src/index.ts.
 *
 * Uso: `npm run verify:tools` (corre con tsx, no requiere build).
 * Exit code 0 si todo OK; 1 si hay alguna falla.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

import { accountantTools } from '../src/tools/accountant.js';
import { accountingReportTools } from '../src/tools/accounting-reports.js';
import { accountingTools } from '../src/tools/accounting.js';
import { accountingWriteTools } from '../src/tools/accounting-write.js';
import { agricultureTools } from '../src/tools/agriculture.js';
import { authTools } from '../src/tools/auth.js';
import { chatterTools } from '../src/tools/chatter.js';
import { companyTools } from '../src/tools/companies.js';
import { connectCommonTools } from '../src/tools/connect-common.js';
import { connectConsumerTools } from '../src/tools/connect-consumer.js';
import { connectGymTools } from '../src/tools/connect-gym.js';
import { connectMerchantTools } from '../src/tools/connect-merchant.js';
import { connectSpecialistTools } from '../src/tools/connect-specialist.js';
import { customerTools } from '../src/tools/customers.js';
import { dataLoadingTools } from '../src/tools/data-loading.js';
import { gastronomyTools } from '../src/tools/gastronomy.js';
import { healthTools } from '../src/tools/health.js';
import { hospitalityTools } from '../src/tools/hospitality.js';
import { hrAttendanceTools } from '../src/tools/hr-attendance.js';
import { imageTools } from '../src/tools/images.js';
import { inventoryTools } from '../src/tools/inventory.js';
import { logisticsTools } from '../src/tools/logistics.js';
import { mercadoLibreTools } from '../src/tools/mercado-libre.js';
import { notificationsTools } from '../src/tools/notifications.js';
import { partnersWriteTools } from '../src/tools/partners-write.js';
import { posTools } from '../src/tools/pos.js';
import { priceListTools } from '../src/tools/price-lists.js';
import { productTools } from '../src/tools/products.js';
import { productWriteTools } from '../src/tools/products-write.js';
import { purchaseTools } from '../src/tools/purchases.js';
import { purchasesActionsTools } from '../src/tools/purchases-actions.js';
import { salesActionsTools } from '../src/tools/sales-actions.js';
import { salesTools } from '../src/tools/sales.js';
import { userTools } from '../src/tools/users.js';

const allTools: Tool[] = [
  ...accountantTools, ...accountingReportTools, ...accountingTools, ...accountingWriteTools,
  ...agricultureTools, ...authTools, ...chatterTools, ...companyTools,
  ...connectCommonTools, ...connectConsumerTools, ...connectGymTools, ...connectMerchantTools,
  ...connectSpecialistTools, ...customerTools, ...dataLoadingTools, ...gastronomyTools,
  ...healthTools, ...hospitalityTools, ...hrAttendanceTools, ...imageTools,
  ...inventoryTools, ...logisticsTools, ...mercadoLibreTools, ...notificationsTools,
  ...partnersWriteTools, ...posTools, ...priceListTools, ...productTools,
  ...productWriteTools, ...purchaseTools, ...purchasesActionsTools, ...salesActionsTools,
  ...salesTools, ...userTools,
];

const errors: string[] = [];

// 1 + 2: title + hints por tool
const seen = new Map<string, number>();
for (const tool of allTools) {
  const ann = (tool.annotations ?? {}) as Record<string, unknown>;
  const title = ann.title;
  if (typeof title !== 'string' || title.trim() === '') {
    errors.push(`[title] La tool "${tool.name}" no tiene annotations.title.`);
  }
  if (ann.readOnlyHint === undefined && ann.destructiveHint === undefined) {
    errors.push(`[hint] La tool "${tool.name}" no declara readOnlyHint ni destructiveHint.`);
  }
  // 3: duplicados
  seen.set(tool.name, (seen.get(tool.name) ?? 0) + 1);
}
for (const [name, count] of seen) {
  if (count > 1) errors.push(`[dup] La tool "${name}" está declarada ${count} veces.`);
}

// 4: cobertura del dispatcher en index.ts
const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(here, '../src/index.ts'), 'utf8');
const cases = new Set<string>();
for (const m of indexSrc.matchAll(/case\s+'([a-zA-Z0-9_]+)'\s*:/g)) cases.add(m[1]);
for (const name of seen.keys()) {
  if (!cases.has(name)) errors.push(`[dispatch] La tool "${name}" no tiene case en src/index.ts.`);
}

// Reporte
const total = allTools.length;
if (errors.length === 0) {
  console.log(`OK: ${total} tools verificadas: todas con title + hint, sin duplicados y con dispatch en index.ts.`);
  process.exit(0);
} else {
  console.error(`FAIL: ${errors.length} problema(s) sobre ${total} tools:\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
