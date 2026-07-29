-- Elimina las materialized views mv_balance_by_currency y mv_monthly_flow,
-- definidas originalmente en prisma/sql/envios-constraints.sql.
--
-- Motivo: nunca quedaron cableadas. El comentario en envios-constraints.sql
-- indica que se refrescan desde src/modules/envios/lib/refresh-views.ts, pero
-- ese archivo no existe en el codebase, y ningun query/action referencia
-- mv_balance_by_currency ni mv_monthly_flow (confirmado por búsqueda global
-- en src/). El dashboard de envios (src/modules/envios/queries/dashboard-queries.ts)
-- calcula estos mismos agregados en vivo con Account.groupBy y Operation.groupBy
-- en cada request, por lo que las matviews son codigo muerto: ocupan espacio,
-- nunca se refrescan (quedarian con datos obsoletos si algo llegara a
-- consultarlas) y no aportan valor.
--
-- NO aplicar automaticamente: correr manualmente con psql cuando se confirme
-- que ningun reporte externo (BI, exports, dashboards fuera del repo) depende
-- de ellas.

DROP MATERIALIZED VIEW IF EXISTS mv_monthly_flow;
DROP MATERIALIZED VIEW IF EXISTS mv_balance_by_currency;
