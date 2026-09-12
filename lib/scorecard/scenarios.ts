/**
 * Plate-appearance scenarios for the scorecard lab: what happened, how a
 * scorer writes it on a paper card, and what the app must read from the box.
 */
import type { Lang } from '@/lib/rules/config'
import type { BaseRunners } from './interpret'

export interface BoxExpectation {
  token: string
  bases: BaseRunners
  outNumber: number
  balls?: number
  strikes?: number
  /** the play produced a batted ball, so a hit line is expected */
  hit?: boolean
}

export interface BoxScenario {
  key: string
  title: Record<Lang, string>
  happened: Record<Lang, string>
  onPaper: Record<Lang, string>
  expected: BoxExpectation
}

const B = (first = false, second = false, third = false, home = false): BaseRunners => ({ first, second, third, home })

export const BOX_SCENARIOS: BoxScenario[] = [
  {
    key: 'k',
    title: { es: 'Ponche abanicando', en: 'Strikeout swinging' },
    happened: { es: 'Cuenta 1-2, el bateador abanica el tercer strike. Primer out de la entrada.', en: 'Count 1-2, the batter swings at strike three. First out of the inning.' },
    onPaper: { es: 'Escribe "K" en el centro y marca 1 bola y 2 strikes en las cajitas; círculo con el 1 abajo a la derecha.', en: 'Write "K" in the middle, fill 1 ball and 2 strike boxes; circle with a 1 in the lower right.' },
    expected: { token: 'K', bases: B(), outNumber: 1, balls: 1, strikes: 2 },
  },
  {
    key: 'kc',
    title: { es: 'Ponche sin swing', en: 'Strikeout looking' },
    happened: { es: 'Tercer strike cantado. Segundo out.', en: 'Called third strike. Second out.' },
    onPaper: { es: '"Kc" (o K al revés) en el centro; círculo con el 2.', en: '"Kc" (or backwards K) in the middle; circle with a 2.' },
    expected: { token: 'Kc', bases: B(), outNumber: 2 },
  },
  {
    key: 'bb',
    title: { es: 'Base por bolas', en: 'Walk' },
    happened: { es: 'Cuatro bolas; el bateador llega a primera.', en: 'Four balls; the batter reaches first.' },
    onPaper: { es: '"BB" y la línea de home a primera; 3 cajitas de bola llenas.', en: '"BB" and the line from home to first; 3 ball boxes filled.' },
    expected: { token: 'BB', bases: B(true), outNumber: 0, balls: 3 },
  },
  {
    key: 'hbp',
    title: { es: 'Golpeado por lanzamiento', en: 'Hit by pitch' },
    happened: { es: 'El lanzamiento golpea al bateador; llega a primera.', en: 'The pitch hits the batter; he reaches first.' },
    onPaper: { es: '"HBP" y la línea a primera.', en: '"HBP" and the line to first.' },
    expected: { token: 'HBP', bases: B(true), outNumber: 0 },
  },
  {
    key: 'single_lf',
    title: { es: 'Sencillo al jardín izquierdo', en: 'Single to left field' },
    happened: { es: 'Línea al jardín izquierdo, el bateador se queda en primera.', en: 'Line drive to left, the batter stops at first.' },
    onPaper: { es: '"1B", la línea a primera y el trazo del batazo desde home hacia el jardín izquierdo.', en: '"1B", the line to first, and the ball line from home toward left field.' },
    expected: { token: '1B', bases: B(true), outNumber: 0, hit: true },
  },
  {
    key: 'double_gap',
    title: { es: 'Doble por el hueco', en: 'Double in the gap' },
    happened: { es: 'Batazo entre el central y el derecho; el bateador llega a segunda.', en: 'Ball in the right-center gap; the batter reaches second.' },
    onPaper: { es: '"2B", líneas de home a primera y a segunda, trazo del batazo al jardín central-derecho.', en: '"2B", lines home to first and to second, ball line to right-center.' },
    expected: { token: '2B', bases: B(true, true), outNumber: 0, hit: true },
  },
  {
    key: 'triple',
    title: { es: 'Triple', en: 'Triple' },
    happened: { es: 'Batazo profundo al derecho; el bateador llega a tercera.', en: 'Deep to right; the batter reaches third.' },
    onPaper: { es: '"3B", líneas hasta tercera y el trazo del batazo profundo al derecho.', en: '"3B", lines to third and the deep ball line to right.' },
    expected: { token: '3B', bases: B(true, true, true), outNumber: 0, hit: true },
  },
  {
    key: 'hr',
    title: { es: 'Jonrón', en: 'Home run' },
    happened: { es: 'La pelota sale por el jardín izquierdo; el bateador anota.', en: 'Ball over the left-field fence; the batter scores.' },
    onPaper: { es: '"HR", el diamante completo rellenado (o las cuatro líneas) y el trazo del batazo profundo.', en: '"HR", the whole diamond filled (or all four lines) and the deep ball line.' },
    expected: { token: 'HR', bases: B(true, true, true, true), outNumber: 0, hit: true },
  },
  {
    key: 'go_63',
    title: { es: 'Rodado al campo corto', en: 'Ground out to short' },
    happened: { es: 'Rodado al 6, tiro a primera. Primer out.', en: 'Grounder to the shortstop, throw to first. First out.' },
    onPaper: { es: '"6-3" en el centro, trazo corto del batazo hacia el campo corto, círculo con el 1.', en: '"6-3" in the middle, a short ball line toward short, circle with a 1.' },
    expected: { token: '6-3', bases: B(), outNumber: 1, hit: true },
  },
  {
    key: 'go_43',
    title: { es: 'Rodado a segunda', en: 'Ground out to second' },
    happened: { es: 'Rodado al 4, tiro a primera. Segundo out.', en: 'Grounder to second, throw to first. Second out.' },
    onPaper: { es: '"4-3", trazo corto hacia segunda, círculo con el 2.', en: '"4-3", short line toward second, circle with a 2.' },
    expected: { token: '4-3', bases: B(), outNumber: 2, hit: true },
  },
  {
    key: 'fly_8',
    title: { es: 'Elevado al central', en: 'Fly out to center' },
    happened: { es: 'Elevado atrapado por el jardinero central. Tercer out.', en: 'Fly ball caught by the center fielder. Third out.' },
    onPaper: { es: '"F8" (o "F-8"), trazo del batazo al central, círculo con el 3.', en: '"F8" (or "F-8"), ball line to center, circle with a 3.' },
    expected: { token: 'F8', bases: B(), outNumber: 3, hit: true },
  },
  {
    key: 'line_6',
    title: { es: 'Línea al campo corto', en: 'Line out to short' },
    happened: { es: 'Línea atrapada por el 6. Primer out.', en: 'Liner caught by the shortstop. First out.' },
    onPaper: { es: '"L6", trazo corto, círculo con el 1.', en: '"L6", short line, circle with a 1.' },
    expected: { token: 'L6', bases: B(), outNumber: 1, hit: true },
  },
  {
    key: 'pop_4',
    title: { es: 'Elevado corto a segunda', en: 'Pop out to second' },
    happened: { es: 'Elevadito atrapado por el 4. Segundo out.', en: 'Pop-up caught by the second baseman. Second out.' },
    onPaper: { es: '"P4", círculo con el 2.', en: '"P4", circle with a 2.' },
    expected: { token: 'P4', bases: B(), outNumber: 2, hit: true },
  },
  {
    key: 'error_6',
    title: { es: 'Error del campo corto', en: 'Error by the shortstop' },
    happened: { es: 'Rodado al 6 que pifia; el bateador llega a primera.', en: 'Grounder to short, booted; the batter reaches first.' },
    onPaper: { es: '"E6", trazo corto hacia el campo corto y la línea a primera.', en: '"E6", short ball line toward short and the line to first.' },
    expected: { token: 'E', bases: B(true), outNumber: 0, hit: true },
  },
  {
    key: 'fc',
    title: { es: 'Selección del fildeador', en: "Fielder's choice" },
    happened: { es: 'Rodado al 6; ponen out al corredor en segunda, el bateador queda en primera. Primer out.', en: 'Grounder to short; the runner is forced at second, the batter is safe at first. First out.' },
    onPaper: { es: '"FC" (o "6-4"), línea a primera, círculo con el 1 (el out es del corredor).', en: '"FC" (or "6-4"), line to first, circle with a 1 (the out belongs to the runner).' },
    expected: { token: 'FC', bases: B(true), outNumber: 1, hit: true },
  },
  {
    key: 'sf',
    title: { es: 'Elevado de sacrificio', en: 'Sacrifice fly' },
    happened: { es: 'Elevado al derecho, el corredor de tercera anota. Primer out, una carrera impulsada.', en: 'Fly to right, the runner on third scores. First out, one RBI.' },
    onPaper: { es: '"SF9" (o "SF"), trazo del batazo al derecho, círculo con el 1.', en: '"SF9" (or "SF"), ball line to right, circle with a 1.' },
    expected: { token: 'SF', bases: B(), outNumber: 1, hit: true },
  },
  {
    key: 'sac',
    title: { es: 'Toque de sacrificio', en: 'Sacrifice bunt' },
    happened: { es: 'Toque frente al plato, out en primera, el corredor avanza. Primer out.', en: 'Bunt in front of the plate, out at first, the runner advances. First out.' },
    onPaper: { es: '"SAC" (o "SAC 1-3"), trazo muy corto, círculo con el 1.', en: '"SAC" (or "SAC 1-3"), very short ball line, circle with a 1.' },
    expected: { token: 'SAC', bases: B(), outNumber: 1, hit: true },
  },
  {
    key: 'dp',
    title: { es: 'Doble play 6-4-3', en: '6-4-3 double play' },
    happened: { es: 'Rodado al 6, out en segunda y en primera. Outs 1 y 2 en la misma jugada.', en: 'Grounder to short, outs at second and first. Outs 1 and 2 on one play.' },
    onPaper: { es: '"6-4-3" (o "DP"), trazo corto, círculo con el 2 en la casilla del bateador.', en: '"6-4-3" (or "DP"), short ball line, circle with a 2 in the batter\'s box.' },
    expected: { token: '6-4-3', bases: B(), outNumber: 2, hit: true },
  },
  {
    key: 'single_then_score',
    title: { es: 'Sencillo y después anota', en: 'Single, later scores' },
    happened: { es: 'Sencillo al central; con los siguientes bateadores llega a tercera y anota.', en: 'Single to center; he reaches third and scores on the following batters.' },
    onPaper: { es: '"1B", trazo del batazo al central, y las cuatro líneas del diamante (o el diamante rellenado) porque anotó.', en: '"1B", ball line to center, and all four lines (or the filled diamond) because he scored.' },
    expected: { token: '1B', bases: B(true, true, true, true), outNumber: 0, hit: true },
  },
  {
    key: 'walk_then_cs',
    title: { es: 'Base por bolas y out robando', en: 'Walk, then caught stealing' },
    happened: { es: 'Llega por base por bolas, intenta robar segunda y lo ponen out. Segundo out.', en: 'Reaches on a walk, tries to steal second and is thrown out. Second out.' },
    onPaper: { es: '"BB", línea a primera, "CS" a media línea de primera a segunda, círculo con el 2.', en: '"BB", line to first, "CS" halfway between first and second, circle with a 2.' },
    expected: { token: 'BB', bases: B(true), outNumber: 2, balls: 3 },
  },
]
