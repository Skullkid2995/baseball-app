# Guía de Base de Datos: Almacenamiento de Lineups

Esta guía explica dónde y cómo se guardan las alineaciones (lineups) en la base de datos.

## 📊 Estructura de Tablas

### 1. Tabla `lineup_templates`
**Ubicación:** Base de datos Supabase → Tabla `lineup_templates`

**Propósito:** Almacena las plantillas de alineación para cada equipo.

**Campos:**
- `id` (UUID) - Identificador único de la plantilla
- `team_id` (UUID) - Referencia al equipo (Dodgers, Piratas, etc.)
- `name` (VARCHAR) - Nombre de la plantilla (ej: "Default Lineup", "Lineup de juego")
- `created_at` (TIMESTAMP) - Fecha de creación
- `updated_at` (TIMESTAMP) - Fecha de última actualización

**Ejemplo de registro:**
```
id: "abc-123-def"
team_id: "dodgers-team-id"
name: "Default Lineup"
created_at: "2024-01-15 10:30:00"
updated_at: "2024-01-15 10:30:00"
```

### 2. Tabla `lineup_template_players`
**Ubicación:** Base de datos Supabase → Tabla `lineup_template_players`

**Propósito:** Almacena los jugadores y su orden de bateo para cada plantilla.

**Campos:**
- `id` (UUID) - Identificador único
- `template_id` (UUID) - Referencia a `lineup_templates.id`
- `player_id` (UUID) - Referencia al jugador en la tabla `players`
- `batting_order` (INTEGER) - Orden de bateo (1-9 o 1-10 si hay DH)
- `position` (VARCHAR) - Posición en el campo (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH)

**Ejemplo de registros:**
```
template_id: "abc-123-def"
player_id: "player-1-id"
batting_order: 1
position: "SS"

template_id: "abc-123-def"
player_id: "player-2-id"
batting_order: 2
position: "CF"
...
```

### 3. Tabla `games`
**Ubicación:** Base de datos Supabase → Tabla `games`

**Propósito:** Vincula las plantillas de alineación al juego específico.

**Campos relevantes:**
- `id` (UUID) - Identificador del juego
- `lineup_template_id` (UUID, opcional) - Referencia a la plantilla de Dodgers (equipo local)
- `opponent_lineup_template_id` (UUID, opcional) - Referencia a la plantilla del equipo visitante
- `team_id` (UUID, opcional) - Referencia al equipo local (Dodgers)
- `opponent` (VARCHAR) - Nombre del equipo oponente

**Ejemplo de registro:**
```
id: "game-123"
opponent: "Piratas"
lineup_template_id: "dodgers-template-id"
opponent_lineup_template_id: "piratas-template-id"
team_id: "dodgers-team-id"
```

## 🔄 Flujo de Guardado

### Cuando guardas la alineación de Dodgers:

1. **Se crea/actualiza en `lineup_templates`:**
   ```sql
   INSERT INTO lineup_templates (team_id, name)
   VALUES ('dodgers-team-id', 'Default Lineup')
   ```

2. **Se guardan los jugadores en `lineup_template_players`:**
   ```sql
   INSERT INTO lineup_template_players (template_id, player_id, batting_order, position)
   VALUES 
     ('template-id', 'player-1-id', 1, 'SS'),
     ('template-id', 'player-2-id', 2, 'CF'),
     ...
   ```

3. **Se vincula al juego en `games`:**
   ```sql
   UPDATE games 
   SET lineup_template_id = 'template-id'
   WHERE id = 'game-id'
   ```

### Cuando guardas la alineación del oponente (Piratas):

1. **Se crea/actualiza en `lineup_templates`:**
   ```sql
   INSERT INTO lineup_templates (team_id, name)
   VALUES ('piratas-team-id', 'Piratas Lineup')
   ```

2. **Se guardan los jugadores en `lineup_template_players`:**
   ```sql
   INSERT INTO lineup_template_players (template_id, player_id, batting_order, position)
   VALUES 
     ('opponent-template-id', 'opponent-player-1-id', 1, 'SS'),
     ...
   ```

3. **Se vincula al juego en `games`:**
   ```sql
   UPDATE games 
   SET opponent_lineup_template_id = 'opponent-template-id'
   WHERE id = 'game-id'
   ```

## 🔍 Cómo Verificar en DBeaver

### Ver si Dodgers tiene lineup guardado:
```sql
SELECT 
  g.id as game_id,
  g.opponent,
  g.lineup_template_id,
  lt.name as dodgers_lineup_name,
  COUNT(ltp.id) as players_count
FROM games g
LEFT JOIN lineup_templates lt ON lt.id = g.lineup_template_id
LEFT JOIN lineup_template_players ltp ON ltp.template_id = lt.id
WHERE g.id = 'tu-game-id'
GROUP BY g.id, g.opponent, g.lineup_template_id, lt.name;
```

### Ver si el oponente tiene lineup guardado:
```sql
SELECT 
  g.id as game_id,
  g.opponent,
  g.opponent_lineup_template_id,
  lt.name as opponent_lineup_name,
  COUNT(ltp.id) as players_count
FROM games g
LEFT JOIN lineup_templates lt ON lt.id = g.opponent_lineup_template_id
LEFT JOIN lineup_template_players ltp ON ltp.template_id = lt.id
WHERE g.id = 'tu-game-id'
GROUP BY g.id, g.opponent, g.opponent_lineup_template_id, lt.name;
```

### Ver ambas alineaciones para un juego:
```sql
SELECT 
  g.id as game_id,
  g.opponent,
  g.lineup_template_id as dodgers_template_id,
  g.opponent_lineup_template_id as opponent_template_id,
  CASE 
    WHEN g.lineup_template_id IS NOT NULL THEN '✓ Guardada'
    ELSE '✗ Pendiente'
  END as dodgers_status,
  CASE 
    WHEN g.opponent_lineup_template_id IS NOT NULL THEN '✓ Guardada'
    ELSE '✗ Pendiente'
  END as opponent_status
FROM games g
WHERE g.id = 'tu-game-id';
```

### Ver el orden de bateo completo:
```sql
-- Para Dodgers
SELECT 
  ltp.batting_order,
  p.first_name || ' ' || p.last_name as player_name,
  p.jersey_number,
  ltp.position
FROM lineup_template_players ltp
JOIN players p ON p.id = ltp.player_id
WHERE ltp.template_id = 'dodgers-template-id'
ORDER BY ltp.batting_order;

-- Para Oponente
SELECT 
  ltp.batting_order,
  p.first_name || ' ' || p.last_name as player_name,
  p.jersey_number,
  ltp.position
FROM lineup_template_players ltp
JOIN players p ON p.id = ltp.player_id
WHERE ltp.template_id = 'opponent-template-id'
ORDER BY ltp.batting_order;
```

## 📍 Ubicación en DBeaver

1. **Abre DBeaver** y conéctate a tu base de datos Supabase
2. **Navega a las tablas:**
   - `public.games` - Aquí se vinculan las plantillas al juego
   - `public.lineup_templates` - Aquí se guardan las plantillas
   - `public.lineup_template_players` - Aquí se guardan los jugadores en orden

3. **Para ver las alineaciones de un juego específico:**
   - Busca el `id` del juego en la tabla `games`
   - Usa ese `id` para buscar `lineup_template_id` y `opponent_lineup_template_id`
   - Con esos IDs, busca en `lineup_template_players` para ver el orden de bateo

## ✅ Validación Visual

El sistema ahora muestra:
- **✓ Verde** - Alineación guardada (check verde en la esquina + badge verde)
- **⚠ Amarillo** - Alineación pendiente (reloj amarillo en la esquina + badge amarillo)

Estos indicadores se actualizan automáticamente cuando guardas una plantilla.

