/* Rate limiting REMOVED — system never blocks conversions.
 *
 * Two named middlewares are still exported as no-ops so existing
 * `require(...).global` / `require(...).processing` references in
 * routes/server.js keep working without touching their wiring.
 * Re-enable later by reverting to the previous express-rate-limit
 * config.
 */
const noop = (_req, _res, next) => next();
module.exports = { global: noop, processing: noop };
