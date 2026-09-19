-- =============================================
-- ENTREGAS - Permiso del módulo
--
-- Las entregas vivían dentro de envios: quien hoy tiene permiso `envios`
-- recibe también `entregas` para no perder acceso al separar el módulo.
-- Los admins pasan siempre por rol, pero se les registra igual para que el
-- listado de permisos sea explícito.
--
-- Idempotente (ON CONFLICT DO NOTHING). Aplicar con:
--   node scripts/apply-sql.mjs prisma/sql/entregas-permissions.sql
-- =============================================

INSERT INTO user_module_permissions (user_id, module_id, action)
SELECT u.user_id, 'entregas', '*'
  FROM users u
 WHERE u.role = 'admin'
    OR EXISTS (
         SELECT 1
           FROM user_module_permissions p
          WHERE p.user_id = u.user_id
            AND p.module_id = 'envios'
       )
ON CONFLICT (user_id, module_id, action) DO NOTHING;
