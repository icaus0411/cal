'use strict';
// 소유자 정보는 모두 이 데이터에서 관리한다. [ ] 로 표시된 값은 실제 내용으로 교체할 것.
const data = {
  skills: [
    { group: 'LANGUAGES', items: ['[언어 1]', '[언어 2]', '[언어 3]'] },
    { group: 'FRAMEWORKS', items: ['[프레임워크 1]', '[프레임워크 2]'] },
    { group: 'TOOLS', items: ['Git', '[도구 1]', '[도구 2]'] }
  ],
  projects: [
    { name: '[프로젝트 이름 1]', desc: '[프로젝트 설명을 한 줄로 적어 주세요]', stack: ['[기술]', '[기술]'], link: '' },
    { name: '[프로젝트 이름 2]', desc: '[프로젝트 설명을 한 줄로 적어 주세요]', stack: ['[기술]', '[기술]'], link: '' },
    { name: '[프로젝트 이름 3]', desc: '[프로젝트 설명을 한 줄로 적어 주세요]', stack: ['[기술]', '[기술]'], link: '' }
  ],
  contacts: [
    { label: 'EMAIL', text: '[이메일 주소]', href: '' },
    { label: 'GITHUB', text: '[GitHub 주소]', href: '' }
  ]
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function externalLink(node, href) {
  node.href = href;
  if (/^https?:/.test(href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  return node;
}

document.getElementById('skill-list').append(...data.skills.map(group => {
  const card = el('div', 'panel');
  const chips = el('ul', 'chips');
  chips.append(...group.items.map(item => el('li', '', item)));
  card.append(el('h3', '', group.group), chips);
  return card;
}));

document.getElementById('project-list').append(...data.projects.map((project, index) => {
  const card = el('article', 'panel project');
  const chips = el('ul', 'chips');
  chips.append(...project.stack.map(item => el('li', '', item)));
  card.append(el('span', 'num', String(index + 1).padStart(2, '0')), el('h3', '', project.name), el('p', '', project.desc), chips);
  if (project.link) card.append(externalLink(el('a', 'more', '자세히 보기 →'), project.link));
  return card;
}));

document.getElementById('contact-list').append(...data.contacts.map(contact => {
  const item = el('li');
  const value = contact.href ? externalLink(el('a', '', contact.text), contact.href) : el('span', '', contact.text);
  item.append(el('b', '', contact.label), value);
  return item;
}));

document.getElementById('year').textContent = new Date().getFullYear();

// ===== 반짝임 효과 =====
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 스크롤 등장
const revealTargets = document.querySelectorAll('.block h2, .panel');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealTargets.forEach(node => node.classList.add('reveal', 'in'));
} else {
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealTargets.forEach((node, i) => { node.classList.add('reveal'); node.style.transitionDelay = (i % 3) * 0.08 + 's'; io.observe(node); });
}

if (!reduceMotion) {
  // 마우스를 따라다니는 빛
  window.addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--mx', e.clientX + 'px');
    document.documentElement.style.setProperty('--my', e.clientY + 'px');
  });

  // 직무 타이핑 효과
  const typed = document.getElementById('typed'), full = typed.dataset.text;
  typed.textContent = '';
  let n = 0;
  const timer = setInterval(() => { typed.textContent = full.slice(0, ++n); if (n >= full.length) clearInterval(timer); }, 90);

  // 네온 비 + 반짝이는 입자 캔버스
  const canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');
  const glyphs = '01ABCDEF<>/{}[]$#%&*+=ｱｲｳｴｵｶｷｸｹｺ'.split('');
  const colors = ['#00f0ff', '#ff2a8a', '#fcee0a'];
  let w, h, cols, drops, stars;
  function resize() {
    w = canvas.width = innerWidth; h = canvas.height = innerHeight;
    cols = Math.ceil(w / 22);
    drops = Array.from({ length: cols }, () => Math.random() * -50);
    stars = Array.from({ length: Math.min(90, Math.floor(w / 14)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + .4,
      p: Math.random() * 6.28, c: colors[Math.floor(Math.random() * 3)]
    }));
  }
  resize(); addEventListener('resize', resize);
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 60) return;
    last = t;
    ctx.fillStyle = 'rgba(7, 6, 15, .16)'; ctx.fillRect(0, 0, w, h);
    ctx.font = '16px monospace';
    for (let i = 0; i < cols; i++) {
      if (i % 3 !== 0) continue;
      ctx.fillStyle = i % 9 === 0 ? 'rgba(255, 42, 138, .55)' : 'rgba(0, 240, 255, .45)';
      ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * 22, drops[i] * 22);
      if (drops[i] * 22 > h && Math.random() > .975) drops[i] = 0;
      drops[i]++;
    }
    stars.forEach(s => {
      const a = .35 + .65 * Math.abs(Math.sin(t / 500 + s.p));
      ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.shadowColor = s.c; ctx.shadowBlur = 10;
      ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  requestAnimationFrame(frame);
}
