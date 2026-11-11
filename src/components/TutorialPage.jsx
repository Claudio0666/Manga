import React from 'react';

const Mascot = () => (
  <svg className="tutorial-mascot" viewBox="0 0 280 260" role="img" aria-labelledby="mascotTitle mascotDesc">
    <title id="mascotTitle">Momo, o mascote do MangaShelf</title>
    <desc id="mascotDesc">Um pequeno espírito de livro roxo acena ao lado de estrelinhas.</desc>
    <defs>
      <linearGradient id="momoBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d8b4fe" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
      <linearGradient id="momoPages" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#e9e5ff" />
      </linearGradient>
      <filter id="momoShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#3b236a" floodOpacity=".25" />
      </filter>
    </defs>
    <g className="mascot-sparkles" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4">
      <path d="M49 68v18m-9-9h18M226 71v14m-7-7h14M222 180v12m-6-6h12" />
      <path d="m86 49 4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8Z" fill="currentColor" stroke="none" />
    </g>
    <g className="mascot-character" filter="url(#momoShadow)">
      <path d="M95 105c-16-36-13-66-1-71 17-7 32 33 35 54M182 105c16-36 13-66 1-71-17-7-32 33-35 54" fill="url(#momoBody)" stroke="#6d46cb" strokeWidth="5" />
      <path d="M103 97c-7-22-6-39 0-42 8-3 18 19 20 35M174 97c7-22 6-39 0-42-8-3-18 19-20 35" fill="#f3e8ff" opacity=".85" />
      <path d="M61 112c0-12 10-21 22-21h114c12 0 22 9 22 21v85c0 12-10 21-22 21H83c-12 0-22-9-22-21v-85Z" fill="url(#momoBody)" stroke="#6d46cb" strokeWidth="5" />
      <path d="M72 119c0-8 7-15 15-15h51v105H87c-8 0-15-7-15-15v-75ZM138 104h55c8 0 15 7 15 15v75c0 8-7 15-15 15h-55V104Z" fill="url(#momoPages)" />
      <path d="M138 105v104" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round" />
      <path d="M84 134h32m-32 18h32m-32 18h27M160 134h31m-31 18h31m-31 18h27" stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="115" cy="122" rx="4" ry="5" fill="#34214f" />
      <ellipse cx="160" cy="122" rx="4" ry="5" fill="#34214f" />
      <path d="M133 132q5 6 10 0" fill="none" stroke="#b45376" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="102" cy="131" rx="7" ry="4" fill="#fb7185" opacity=".55" />
      <ellipse cx="173" cy="131" rx="7" ry="4" fill="#fb7185" opacity=".55" />
      <path d="M68 194c-11 1-18 7-19 16m159-16c11 1 18 7 19 16" fill="none" stroke="#6d46cb" strokeWidth="7" strokeLinecap="round" />
    </g>
  </svg>
);

const tutorialCards = [
  {
    number: '01', icon: '＋', title: 'Adicione seus mangás',
    text: 'Use Adicionar para buscar títulos nas fontes disponíveis ou preencher os dados manualmente. Escolha capa, status e capítulo inicial.'
  },
  {
    number: '02', icon: '↗', title: 'Acompanhe a leitura',
    text: 'Os botões − e + nos cartões e na lista atualizam o capítulo rapidamente. Clique em um título para ver os detalhes ou use Editar para alterar outras informações.'
  },
  {
    number: '03', icon: '⌕', title: 'Encontre qualquer título',
    text: 'Pesquise por nome ou autor no topo. Combine os status com filtros de gênero, autor, nota e progresso; a ordenação e os modos grade/lista ficam na barra da estante.'
  },
  {
    number: '04', icon: '♡', title: 'Personalize sua estante',
    text: 'Marque favoritos, altere o status e registre nota, datas, sinopse e gêneros. Quando a fonte informa o total de capítulos, o progresso também aparece no cartão.'
  },
  {
    number: '05', icon: '▣', title: 'Proteja seus dados',
    text: 'O rascunho local é salvo automaticamente. Use Salvar para atualizar o arquivo principal e Backup para criar pontos de restauração, exportar ou importar uma cópia.'
  },
  {
    number: '06', icon: '☁', title: 'Use o Google Drive (opcional)',
    text: 'Configure o Drive nas opções da nuvem para enviar ou recuperar uma cópia. A biblioteca continua salva neste dispositivo mesmo sem conectar uma conta.'
  }
];

const TutorialPage = ({ onAddClick, onBackupClick, onBackClick }) => (
  <main className="tutorial-page">
    <section className="tutorial-hero" aria-labelledby="tutorialTitle">
      <div className="tutorial-hero-copy">
        <span className="tutorial-kicker"><i /> GUIA RÁPIDO</span>
        <h1 id="tutorialTitle">Sua estante, do seu jeito.</h1>
        <p>Veja como organizar leituras, acompanhar capítulos e manter seus mangás salvos no MangaShelf.</p>
        <div className="tutorial-hero-actions">
          <button className="btn btn-primary" onClick={onAddClick}>＋ Adicionar meu primeiro mangá</button>
          <button className="btn" onClick={onBackClick}>Voltar à estante</button>
        </div>
      </div>
      <div className="tutorial-mascot-scene">
        <div className="mascot-speech"><strong>Oi, eu sou Momo!</strong><span>Vou mostrar os atalhos da sua estante ✨</span></div>
        <Mascot />
      </div>
    </section>

    <section className="tutorial-section" aria-labelledby="tutorialStepsTitle">
      <div className="tutorial-section-heading">
        <div><span className="tutorial-kicker">COMECE POR AQUI</span><h2 id="tutorialStepsTitle">Tudo o que você precisa saber</h2></div>
        <span className="tutorial-section-note">6 passos simples para aproveitar melhor o app</span>
      </div>
      <div className="tutorial-grid">
        {tutorialCards.map(card => (
          <article className="tutorial-card" key={card.number}>
            <div className="tutorial-card-top"><span className="tutorial-card-icon" aria-hidden="true">{card.icon}</span><span className="tutorial-card-number">{card.number}</span></div>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="tutorial-tip" aria-label="Dica de backup">
      <span className="tutorial-tip-icon" aria-hidden="true">✦</span>
      <div><strong>Dica do Momo</strong><p>Antes de trocar de computador, exporte um backup JSON ou conecte o Google Drive. Assim você leva sua biblioteca junto.</p></div>
      <button className="btn" onClick={onBackupClick}>Abrir backup</button>
    </section>
  </main>
);

export default TutorialPage;
