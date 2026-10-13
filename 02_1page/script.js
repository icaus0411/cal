'use strict';
// 소유자 정보는 모두 이 데이터에서 관리한다. 기술·프로젝트는 소유자 요청으로 작성한 예시 내용이므로 실제 이력에 맞게 교체할 것.
const data = {
  skills: [
    { group: 'LANGUAGES', items: ['SQL', 'Java', 'C#', 'Python', 'JavaScript'] },
    { group: 'DATABASE', items: ['Oracle', 'MS SQL Server', 'PostgreSQL'] },
    { group: 'HEALTHCARE', items: ['EMR / OCS', 'HL7', 'FHIR', 'PACS 연동'] },
    { group: 'WEB', items: ['HTML', 'CSS', 'Spring', 'REST API'] },
    { group: 'TOOLS', items: ['Git', 'GitHub', 'Vercel', 'Claude Code'] }
  ],
  projects: [
    { name: '진료 예약·접수 현황 대시보드', desc: '외래 접수와 대기 현황을 실시간으로 보여주는 원무 지원 화면을 개발했습니다.', stack: ['Java', 'Spring', 'Oracle'], link: '' },
    { name: '검사결과 자동 전송 인터페이스', desc: 'HL7 메시지로 검사 결과를 EMR에 자동 반영하는 연동 모듈을 구축했습니다.', stack: ['HL7', 'C#', 'MS SQL Server'], link: '' },
    { name: '진료 통계 자동 리포트', desc: '수작업이던 월간 진료 통계를 쿼리와 스크립트로 자동화했습니다.', stack: ['SQL', 'Python', 'PostgreSQL'], link: '' }
  ],
  contacts: [
    { label: 'EMAIL', text: 'icarus0411@chabio.com', href: 'mailto:icarus0411@chabio.com' },
    { label: 'GITHUB', text: 'github.com/icaus0411', href: 'https://github.com/icaus0411' }
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
  const glyphs = ['0', '1'];
  const colors = ['#00f0ff', '#ff2a8a', '#fcee0a'];
  const size = 18;
  let w, h, cols, drops, speeds, stars;
  function resize() {
    w = canvas.width = innerWidth; h = canvas.height = innerHeight;
    cols = Math.ceil(w / size);
    drops = Array.from({ length: cols }, () => Math.random() * -h / size);
    speeds = Array.from({ length: cols }, () => .5 + Math.random() * 1.1);
    stars = Array.from({ length: Math.min(40, Math.floor(w / 30)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + .4,
      p: Math.random() * 6.28, c: colors[Math.floor(Math.random() * 3)]
    }));
  }
  resize(); addEventListener('resize', resize);
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 50) return;
    last = t;
    ctx.fillStyle = 'rgba(2, 8, 4, .1)'; ctx.fillRect(0, 0, w, h);
    ctx.font = size + 'px monospace';
    for (let i = 0; i < cols; i++) {
      const x = i * size, y = drops[i] * size;
      const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
      // 꼬리: 어두운 매트릭스 초록, 머리: 밝은 흰빛 초록
      ctx.fillStyle = 'rgba(0, 255, 90, .55)';
      ctx.shadowColor = '#00ff5a'; ctx.shadowBlur = 6;
      ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], x, y - size);
      ctx.fillStyle = '#d8ffe4'; ctx.shadowBlur = 12;
      ctx.fillText(ch, x, y);
      if (y > h && Math.random() > .975) { drops[i] = 0; speeds[i] = .5 + Math.random() * 1.1; }
      drops[i] += speeds[i];
    }
    ctx.shadowBlur = 0;
    // 사이버펑크 포인트: 가끔 반짝이는 시안/핑크/옐로 입자
    stars.forEach(s => {
      const a = .2 + .8 * Math.abs(Math.sin(t / 500 + s.p));
      ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.shadowColor = s.c; ctx.shadowBlur = 10;
      ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2);
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  requestAnimationFrame(frame);
}
