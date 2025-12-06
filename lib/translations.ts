export type Language = 'en' | 'es'

export interface Translations {
  // Header
  appTitle: string
  appSubtitle: string
  logout: string
  // Navigation
  teams: string
  players: string
  games: string
  // Teams
  teamsCount: string
  addTeam: string
  cancel: string
  editTeam: string
  addNewTeam: string
  teamName: string
  city: string
  manager: string
  coach: string
  foundedYear: string
  stadium: string
  updateTeam: string
  adding: string
  updating: string
  // Players
  playersCount: string
  addPlayer: string
  editPlayer: string
  addPlayerTo: string
  updatePlayer: string
  firstName: string
  lastName: string
  dateOfBirth: string
  team: string
  selectTeam: string
  handedness: string
  jerseyNumber: string
  height: string
  weight: string
  contactNumber: string
  emergencyNumber: string
  emergencyContactName: string
  positions: string
  selectAllThatApply: string
  playerPhoto: string
  takePhotoOrUpload: string
  uploading: string
  // Baseball Positions
  pitcher: string
  catcher: string
  firstBase: string
  secondBase: string
  thirdBase: string
  shortstop: string
  leftField: string
  centerField: string
  rightField: string
  designatedHitter: string
  // Handedness
  righty: string
  lefty: string
  switch: string
  // Games
  gamesCount: string
  newGame: string
  vs: string
  // Common
  noItemsFound: string
  addFirstItem: string
  loading: string
  error: string
  // Player display
  noPositions: string
  inches: string
  lbs: string
  feet: string
  // Team display
  founded: string
  // Errors
  failedToFetch: string
  failedToAdd: string
  failedToUpdate: string
  // View controls
  viewPlayers: string
  viewLess: string
  // Login
  signIn: string
  signInWithGoogle: string
  signingIn: string
  signInToAccess: string
  accessDenied: string
  authFailed: string
  onlyAuthorizedUsers: string
  // Games
  opponent: string
  gameDate: string
  gameTime: string
  weather: string
  createNewGame: string
  gameInfo: string
  nextSelectLineup: string
  step2SelectLineup: string
  step3EnterOpponent: string
  creating: string
  date: string
  time: string
  score: string
  status: string
  innings: string
  openScorebook: string
  viewStatistics: string
  close: string
  // Statistics
  hitStatistics: string
  battingAverage: string
  sluggingPercentage: string
  totalAtBats: string
  hits: string
  singles: string
  doubles: string
  triples: string
  homeRuns: string
  rbis: string
  strikeouts: string
  selectPlayer: string
  allPlayers: string
  fieldDistribution: string
  distanceDistribution: string
  angleDistribution: string
  zoneDistribution: string
  // Common game terms
  inning: string
  inningsPlayed: string
  ourScore: string
  opponentScore: string
  // Game actions
  startScoring: string
  continueScoring: string
  viewScorebook: string
  clearGameData: string
  clearData: string
  selectLineup: string
  selectOurLineup: string
  // Statistics labels
  filterByTeam: string
  filterByPlayer: string
  hitTypes: string
  whereHitsLand: string
  hitDirection: string
  recentAtBats: string
  fieldAreas: string
  hitDistance: string
  hitAngles: string
  specificZones: string
  player: string
  result: string
  fieldArea: string
  sluggingPercent: string
  noStatisticsAvailable: string
  distance: string
  angle: string
  // New features
  teamLogo: string
  uploadTeamLogo: string
  removeFromTeam: string
  removing: string
  selectPlayerToAdd: string
  playersWithoutTeams: string
  noPlayersWithoutTeams: string
  newPlayer: string
  createNewPlayer: string
  selectExistingPlayer: string
  selectExistingPlayerHint: string
  noTeam: string
  noTeamRemove: string
  playerExistsOnTeam: string
  playerExistsOnTeamMessage: string
}

const translations: Record<Language, Translations> = {
  en: {
    // Header
    appTitle: 'Baseball Stats',
    appSubtitle: 'Manage teams, players, and live games',
    logout: 'Logout',
    // Navigation
    teams: 'Teams',
    players: 'Players',
    games: 'Games',
    // Teams
    teamsCount: 'Teams',
    addTeam: 'Add Team',
    cancel: 'Cancel',
    editTeam: 'Edit Team',
    addNewTeam: 'Add New Team',
    teamName: 'Team Name',
    city: 'City',
    manager: 'Manager',
    coach: 'Coach',
    foundedYear: 'Founded Year',
    stadium: 'Stadium',
    updateTeam: 'Update Team',
    adding: 'Adding...',
    updating: 'Updating...',
    // Players
    playersCount: 'Players',
    addPlayer: 'Add Player',
    editPlayer: 'Edit Player',
    addPlayerTo: 'Add Player to',
    updatePlayer: 'Update Player',
    firstName: 'First Name',
    lastName: 'Last Name',
    dateOfBirth: 'Date of Birth',
    team: 'Team',
    selectTeam: 'Select a team',
    handedness: 'Handedness',
    jerseyNumber: 'Jersey Number',
    height: 'Height (inches)',
    weight: 'Weight (lbs)',
    contactNumber: 'Contact Number',
    emergencyNumber: 'Emergency Number',
    emergencyContactName: 'Emergency Contact Name',
    positions: 'Positions',
    selectAllThatApply: '(Select all that apply)',
    playerPhoto: 'Player Photo',
    takePhotoOrUpload: 'Take a photo or upload from gallery (max 5MB)',
    uploading: 'Uploading...',
    // Baseball Positions
    pitcher: 'Pitcher (P)',
    catcher: 'Catcher (C)',
    firstBase: 'First Base (1B)',
    secondBase: 'Second Base (2B)',
    thirdBase: 'Third Base (3B)',
    shortstop: 'Shortstop (SS)',
    leftField: 'Left Field (LF)',
    centerField: 'Center Field (CF)',
    rightField: 'Right Field (RF)',
    designatedHitter: 'Designated Hitter (DH)',
    // Handedness
    righty: 'Righty',
    lefty: 'Lefty',
    switch: 'Switch',
    // Games
    gamesCount: 'Games',
    newGame: 'New Game',
    vs: 'vs',
    // Common
    noItemsFound: 'No items found',
    addFirstItem: 'Add your first item using the form above',
    loading: 'Loading...',
    error: 'Error',
    // Player display
    noPositions: 'No positions',
    inches: 'inches',
    lbs: 'lbs',
    feet: 'feet',
    // Team display
    founded: 'Founded',
    // Errors
    failedToFetch: 'Failed to fetch',
    failedToAdd: 'Failed to add',
    failedToUpdate: 'Failed to update',
    // View controls
    viewPlayers: 'View Players',
    viewLess: 'View Less',
    // Login
    signIn: 'Sign In',
    signInWithGoogle: 'Sign in with Google',
    signingIn: 'Signing in...',
    signInToAccess: 'Sign in to access the application',
    accessDenied: 'Access denied. Only authorized users can access this application.',
    authFailed: 'Authentication failed. Please try again.',
    onlyAuthorizedUsers: 'Only authorized users can access this application.',
    // Games
    opponent: 'Opponent',
    gameDate: 'Game Date',
    gameTime: 'Game Time',
    weather: 'Weather',
    createNewGame: 'Create New Game - Game Information',
    gameInfo: 'Game Information',
    nextSelectLineup: 'Next: Select Our Lineup',
    step2SelectLineup: 'Step 2: Select Our Team Lineup',
    step3EnterOpponent: 'Step 3: Enter Opponent Lineup',
    creating: 'Creating...',
    date: 'Date',
    time: 'Time',
    score: 'Score',
    status: 'Status',
    innings: 'Innings',
    openScorebook: 'Open Scorebook',
    viewStatistics: 'Hit Statistics and Analytics',
    close: 'Close',
    // Statistics
    hitStatistics: 'Hit Statistics and Analytics',
    battingAverage: 'Batting Average',
    sluggingPercentage: 'Slugging Percentage',
    totalAtBats: 'Total At-Bats',
    hits: 'Hits',
    singles: 'Singles',
    doubles: 'Doubles',
    triples: 'Triples',
    homeRuns: 'Home Runs',
    rbis: 'RBIs',
    strikeouts: 'Strikeouts',
    selectPlayer: 'Select Player',
    allPlayers: 'All Players',
    fieldDistribution: 'Field Distribution',
    distanceDistribution: 'Distance Distribution',
    angleDistribution: 'Angle Distribution',
    zoneDistribution: 'Zone Distribution',
    // Common game terms
    inning: 'Inning',
    inningsPlayed: 'Innings Played',
    ourScore: 'Our Score',
    opponentScore: 'Opponent Score',
    // Game actions
    startScoring: 'Start Scoring',
    continueScoring: 'Continue Scoring',
    viewScorebook: 'View Scorebook',
    clearGameData: 'Clear Game Data',
    clearData: 'Clear Data',
    selectLineup: 'Select Lineup',
    selectOurLineup: 'Select Our Team Lineup',
    // Statistics labels
    filterByTeam: 'Filter by Team',
    filterByPlayer: 'Filter by Player',
    hitTypes: 'Hit Types',
    whereHitsLand: 'Where Hits Land',
    hitDirection: 'Hit Direction',
    recentAtBats: 'Recent At-Bats',
    fieldAreas: 'Field Areas',
    hitDistance: 'Hit Distance',
    hitAngles: 'Hit Angles',
    specificZones: 'Specific Zones',
    player: 'Player',
    result: 'Result',
    fieldArea: 'Field Area',
    sluggingPercent: 'Slugging %',
    noStatisticsAvailable: 'No statistics available',
    distance: 'Distance',
    angle: 'Angle',
    // New features
    teamLogo: 'Team Logo',
    uploadTeamLogo: 'Upload team logo (max 5MB)',
    removeFromTeam: 'Remove from Team',
    removing: 'Removing...',
    selectPlayerToAdd: 'Select Player to Add to',
    playersWithoutTeams: 'Players Without Teams',
    noPlayersWithoutTeams: 'No players without teams available.',
    newPlayer: 'New Player',
    createNewPlayer: 'Create new player',
    selectExistingPlayer: 'Select existing player without team (optional)',
    selectExistingPlayerHint: 'If a player exists without a team, select them here to assign to a team instead of creating a duplicate.',
    noTeam: 'No Team',
    noTeamRemove: 'No Team (Remove from team)',
    playerExistsOnTeam: 'This player exists on a different team',
    playerExistsOnTeamMessage: 'This player exists on a different team: {teamName}. Please select them from the list instead.',
  },
  es: {
    // Header
    appTitle: 'Estadísticas de Béisbol',
    appSubtitle: 'Gestiona equipos, jugadores y juegos en vivo',
    logout: 'Cerrar Sesión',
    // Navigation
    teams: 'Equipos',
    players: 'Jugadores',
    games: 'Juegos',
    // Teams
    teamsCount: 'Equipos',
    addTeam: 'Agregar Equipo',
    cancel: 'Cancelar',
    editTeam: 'Editar Equipo',
    addNewTeam: 'Agregar Nuevo Equipo',
    teamName: 'Nombre del Equipo',
    city: 'Ciudad',
    manager: 'Mánager',
    coach: 'Entrenador',
    foundedYear: 'Año de Fundación',
    stadium: 'Estadio',
    updateTeam: 'Actualizar Equipo',
    adding: 'Agregando...',
    updating: 'Actualizando...',
    // Players
    playersCount: 'Jugadores',
    addPlayer: 'Agregar Jugador',
    editPlayer: 'Editar Jugador',
    addPlayerTo: 'Agregar Jugador a',
    updatePlayer: 'Actualizar Jugador',
    firstName: 'Nombre',
    lastName: 'Apellido',
    dateOfBirth: 'Fecha de Nacimiento',
    team: 'Equipo',
    selectTeam: 'Selecciona un equipo',
    handedness: 'Lateralidad',
    jerseyNumber: 'Número de Camiseta',
    height: 'Estatura (pulgadas)',
    weight: 'Peso (libras)',
    contactNumber: 'Número de Contacto',
    emergencyNumber: 'Número de Emergencia',
    emergencyContactName: 'Nombre de Contacto de Emergencia',
    positions: 'Posiciones',
    selectAllThatApply: '(Selecciona todas las que apliquen)',
    playerPhoto: 'Foto del Jugador',
    takePhotoOrUpload: 'Toma una foto o sube desde la galería (máx 5MB)',
    uploading: 'Subiendo...',
    // Baseball Positions
    pitcher: 'Lanzador (P)',
    catcher: 'Receptor (C)',
    firstBase: 'Primera Base (1B)',
    secondBase: 'Segunda Base (2B)',
    thirdBase: 'Tercera Base (3B)',
    shortstop: 'Campo Corto (SS)',
    leftField: 'Jardín Izquierdo (LF)',
    centerField: 'Jardín Central (CF)',
    rightField: 'Jardín Derecho (RF)',
    designatedHitter: 'Bateador Designado (DH)',
    // Handedness
    righty: 'Diestro',
    lefty: 'Zurdo',
    switch: 'Ambidiestro',
    // Games
    gamesCount: 'Juegos',
    newGame: 'Nuevo Juego',
    vs: 'vs',
    // Common
    noItemsFound: 'No se encontraron elementos',
    addFirstItem: 'Agrega tu primer elemento usando el formulario de arriba',
    loading: 'Cargando...',
    error: 'Error',
    // Player display
    noPositions: 'Sin posiciones',
    inches: 'pulgadas',
    lbs: 'libras',
    feet: 'pies',
    // Team display
    founded: 'Fundado',
    // Errors
    failedToFetch: 'Error al cargar',
    failedToAdd: 'Error al agregar',
    failedToUpdate: 'Error al actualizar',
    // View controls
    viewPlayers: 'Ver Jugadores',
    viewLess: 'Ver Menos',
    // Login
    signIn: 'Iniciar Sesión',
    signInWithGoogle: 'Iniciar sesión con Google',
    signingIn: 'Iniciando sesión...',
    signInToAccess: 'Inicia sesión para acceder a la aplicación',
    accessDenied: 'Acceso denegado. Solo los usuarios autorizados pueden acceder a esta aplicación.',
    authFailed: 'Error de autenticación. Por favor, inténtalo de nuevo.',
    onlyAuthorizedUsers: 'Solo los usuarios autorizados pueden acceder a esta aplicación.',
    // Games
    opponent: 'Oponente',
    gameDate: 'Fecha del Juego',
    gameTime: 'Hora del Juego',
    weather: 'Clima',
    createNewGame: 'Crear Nuevo Juego - Información del Juego',
    gameInfo: 'Información del Juego',
    nextSelectLineup: 'Siguiente: Seleccionar Alineación',
    step2SelectLineup: 'Paso 2: Seleccionar Alineación de Nuestro Equipo',
    step3EnterOpponent: 'Paso 3: Ingresar Alineación del Oponente',
    creating: 'Creando...',
    date: 'Fecha',
    time: 'Hora',
    score: 'Puntuación',
    status: 'Estado',
    innings: 'Entradas',
    openScorebook: 'Abrir Cuaderno de Anotaciones',
    viewStatistics: 'Estadísticas y Análisis de Bateo',
    close: 'Cerrar',
    // Statistics
    hitStatistics: 'Estadísticas y Análisis de Bateo',
    battingAverage: 'Promedio de Bateo',
    sluggingPercentage: 'Porcentaje de Slugging',
    totalAtBats: 'Total de Turnos al Bate',
    hits: 'Hits',
    singles: 'Singles',
    doubles: 'Dobles',
    triples: 'Triples',
    homeRuns: 'Jonrones',
    rbis: 'Carreras Impulsadas',
    strikeouts: 'Ponches',
    selectPlayer: 'Seleccionar Jugador',
    allPlayers: 'Todos los Jugadores',
    fieldDistribution: 'Distribución del Campo',
    distanceDistribution: 'Distribución de Distancia',
    angleDistribution: 'Distribución de Ángulo',
    zoneDistribution: 'Distribución de Zona',
    // Common game terms
    inning: 'Entrada',
    inningsPlayed: 'Entradas Jugadas',
    ourScore: 'Nuestro Puntaje',
    opponentScore: 'Puntaje del Oponente',
    // Game actions
    startScoring: 'Iniciar Anotación',
    continueScoring: 'Continuar Anotación',
    viewScorebook: 'Ver Anotación',
    clearGameData: 'Borrar Datos del Juego',
    clearData: 'Limpiar Datos',
    selectLineup: 'Elegir Alineación',
    selectOurLineup: 'Seleccionar Alineación de Nuestro Equipo',
    // Statistics labels
    filterByTeam: 'Filtrar por Equipo',
    filterByPlayer: 'Filtrar por Jugador',
    hitTypes: 'Tipos de Hits',
    whereHitsLand: 'Dónde Caen los Hits',
    hitDirection: 'Dirección del Hit',
    recentAtBats: 'Turnos al Bate Recientes',
    fieldAreas: 'Áreas del Campo',
    hitDistance: 'Distancia del Hit',
    hitAngles: 'Ángulos del Hit',
    specificZones: 'Zonas Específicas',
    player: 'Jugador',
    result: 'Resultado',
    fieldArea: 'Área del Campo',
    sluggingPercent: 'Porcentaje de Slugging',
    noStatisticsAvailable: 'No hay estadísticas disponibles',
    distance: 'Distancia',
    angle: 'Ángulo',
    // New features
    teamLogo: 'Logo del Equipo',
    uploadTeamLogo: 'Subir logo del equipo (máx 5MB)',
    removeFromTeam: 'Remover del Equipo',
    removing: 'Removiendo...',
    selectPlayerToAdd: 'Seleccionar Jugador para Agregar a',
    playersWithoutTeams: 'Jugadores Sin Equipos',
    noPlayersWithoutTeams: 'No hay jugadores sin equipos disponibles.',
    newPlayer: 'Nuevo Jugador',
    createNewPlayer: 'Crear nuevo jugador',
    selectExistingPlayer: 'Seleccionar jugador existente sin equipo (opcional)',
    selectExistingPlayerHint: 'Si un jugador existe sin equipo, selecciónalo aquí para asignarlo a un equipo en lugar de crear un duplicado.',
    noTeam: 'Sin Equipo',
    noTeamRemove: 'Sin Equipo (Remover del equipo)',
    playerExistsOnTeam: 'Este jugador existe en un equipo diferente',
    playerExistsOnTeamMessage: 'Este jugador existe en un equipo diferente: {teamName}. Por favor, selecciónalo de la lista en su lugar.',
  },
}

export function getTranslations(lang: Language): Translations {
  return translations[lang]
}

export function getBaseballPositions(lang: Language): string[] {
  const t = getTranslations(lang)
  return [
    t.pitcher,
    t.catcher,
    t.firstBase,
    t.secondBase,
    t.thirdBase,
    t.shortstop,
    t.leftField,
    t.centerField,
    t.rightField,
    t.designatedHitter,
  ]
}

