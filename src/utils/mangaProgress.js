export const adjustMangaChapter = (setLibrary, mangaId, change) => {
  setLibrary(current => current.map(manga => {
    if (manga.id !== mangaId) return manga;
    const currentChapter = Math.max(0, Number(manga.capitulo) || 0);
    const totalChapters = Number(manga.capituloTotal) || 0;
    const nextChapter = Math.max(0, currentChapter + change);
    const boundedChapter = totalChapters > 0 ? Math.min(nextChapter, totalChapters) : nextChapter;
    if (boundedChapter === currentChapter) return manga;
    return {
      ...manga,
      capitulo: boundedChapter,
      lastUpdatedAt: new Date().toISOString()
    };
  }));
};
