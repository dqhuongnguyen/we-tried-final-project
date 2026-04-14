// ── Account dropdown: close when clicking outside ──
document.addEventListener('click', (e) => {
  const open = document.querySelector('.nav-user-dropdown[open]');
  if (!open || open.contains(e.target)) return;
  open.removeAttribute('open');
});

// ── Auto-submit search on typing ──
const searchInput = document.querySelector('.search-input');
if (searchInput) {
  let t;
  searchInput.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => searchInput.closest('form').submit(), 600);
  });
}

// ── Goal card selection ──
document.querySelectorAll('.goal-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    card.querySelector('input').checked = true;
  });
});

// ── Flash auto-hide after 3.5s ──
setTimeout(() => {
  document.querySelectorAll('.flash').forEach(el => {
    el.style.transition = 'opacity .5s, max-height .5s';
    el.style.opacity = '0';
    el.style.maxHeight = '0';
    setTimeout(() => el.remove(), 500);
  });
}, 3500);
