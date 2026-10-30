// Panel de estadísticas visible o no: se recuerda entre canales mientras la
// app esté abierta (igual que Fire TV). Ver PlayerStatsPanel.jsx.
let statsVisible = false;
export const getStatsVisible = () => statsVisible;
export const setStatsVisible = (v) => {
  statsVisible = !!v;
};
