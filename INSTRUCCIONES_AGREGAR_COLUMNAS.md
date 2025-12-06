# Instrucciones para Agregar Columnas home_team_id y away_team_id

## Pasos para Ejecutar el Query SQL

1. **Abre tu Dashboard de Supabase**
   - Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Selecciona tu proyecto

2. **Abre el SQL Editor**
   - En el menú lateral, haz clic en "SQL Editor"
   - O ve directamente a: `https://supabase.com/dashboard/project/[TU_PROYECTO]/sql`

3. **Copia y Pega el Query**
   - Abre el archivo `database/add_home_away_columns.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase

4. **Ejecuta el Query**
   - Haz clic en el botón "Run" o presiona `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Deberías ver un mensaje de éxito indicando que las columnas se agregaron

5. **Verifica que se Crearon Correctamente**
   - Ve a la sección "Table Editor" en Supabase
   - Selecciona la tabla `games`
   - Deberías ver las nuevas columnas `home_team_id` y `away_team_id`

## Contenido del Query SQL

```sql
-- Add home_team_id and away_team_id columns to games table
-- These columns store which team is home and which is away for each game

ALTER TABLE games
ADD COLUMN IF NOT EXISTS home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_home_team_id ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id ON games(away_team_id);

-- Add comments to document the columns
COMMENT ON COLUMN games.home_team_id IS 'Team ID for the home team (bats last in each inning)';
COMMENT ON COLUMN games.away_team_id IS 'Team ID for the away team (bats first in each inning)';
```

## Notas Importantes

- El query usa `IF NOT EXISTS`, por lo que es seguro ejecutarlo múltiples veces
- Las columnas son de tipo UUID y referencian la tabla `teams`
- Se crean índices para mejorar el rendimiento de las consultas
- Después de ejecutar el query, recarga la aplicación y la funcionalidad debería funcionar correctamente

## Solución de Problemas

Si encuentras algún error al ejecutar el query:
- Verifica que tienes permisos de administrador en la base de datos
- Asegúrate de que la tabla `games` existe
- Asegúrate de que la tabla `teams` existe
- Revisa los logs de error en Supabase para más detalles

