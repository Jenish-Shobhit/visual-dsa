(() => {
  const input = document.querySelector('#study-search');
  const count = document.querySelector('#study-count');
  if (!input || !count) return;
  const groups = [...document.querySelectorAll('.study-index .group')];
  const normalize = value => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
  const filter = () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    let visibleGroups = 0;
    groups.forEach(group => {
      const groupText = normalize(group.querySelector('.group-heading')?.textContent || '');
      let visible = 0;
      group.querySelectorAll('li').forEach(row => {
        const text = `${groupText} ${normalize(row.textContent)}`;
        const match = terms.every(term => text.includes(term));
        row.hidden = !match;
        if (match) visible++;
      });
      group.hidden = visible === 0;
      if (visible) visibleGroups++;
      shown += visible;
    });
    count.textContent = terms.length
      ? `${shown} ${shown === 1 ? 'study' : 'studies'} found${shown ? ` across ${visibleGroups} ${visibleGroups === 1 ? 'theme' : 'themes'}` : '. Try a broader term.'}`
      : '24 studies across 6 themes';
  };
  input.addEventListener('input', filter);
  filter();
})();
