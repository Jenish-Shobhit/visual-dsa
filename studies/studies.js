/* Deep-study library: live search over the study cards (studies/index.html). */
(() => {
  const input = document.querySelector('#study-search');
  const count = document.querySelector('#study-count');
  if (!input || !count) return;
  const empty = document.querySelector('#study-empty');
  const groups = [...document.querySelectorAll('.lib-group')];
  const total = groups.reduce((n, g) => n + g.querySelectorAll('.lib-card').length, 0);
  const normalize = value => value.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
  const filter = () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let shown = 0, visibleGroups = 0;
    groups.forEach(group => {
      const groupText = normalize(group.querySelector('.lib-group__head')?.textContent || '');
      let visible = 0;
      group.querySelectorAll('.lib-card').forEach(card => {
        const text = `${groupText} ${normalize(card.textContent)}`;
        const match = terms.every(term => text.includes(term));
        card.hidden = !match;
        if (match) visible++;
      });
      group.hidden = visible === 0;
      if (visible) visibleGroups++;
      shown += visible;
    });
    if (empty) empty.hidden = shown !== 0;
    count.textContent = terms.length
      ? `${shown} ${shown === 1 ? 'study' : 'studies'} found${shown ? ` across ${visibleGroups} ${visibleGroups === 1 ? 'theme' : 'themes'}` : ''}`
      : `${total} studies across ${groups.length} themes`;
  };
  input.addEventListener('input', filter);
  filter();
})();
