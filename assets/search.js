// 首页的即时搜索 + 分类筛选(纯前端,无依赖)
(function () {
  var q = document.getElementById('q');
  var buttons = document.querySelectorAll('#cat-filters .chip-btn');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat-section'));
  var empty = document.getElementById('empty');
  if (!q || !cards.length) return;

  var activeCat = '';

  function apply() {
    var text = q.value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (c) {
      var hitText = !text || (c.getAttribute('data-search') || '').indexOf(text) !== -1;
      var cats = (c.getAttribute('data-categories') || '').split(' ');
      var hitCat = !activeCat || cats.indexOf(activeCat) !== -1;
      var show = hitText && hitCat;
      c.hidden = !show;
      if (show) visible++;
    });
    sections.forEach(function (s) {
      var sectionCat = s.getAttribute('data-section-cat');
      var anyVisible = Array.prototype.some.call(s.querySelectorAll('.card'), function (c) {
        return !c.hidden;
      });
      // 选中某分类时,其他分类的整节隐藏;搜索时按是否有可见卡片隐藏
      s.hidden = (activeCat && sectionCat !== activeCat) || !anyVisible;
    });
    if (empty) empty.hidden = visible > 0;
  }

  q.addEventListener('input', apply);
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      buttons.forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      activeCat = b.getAttribute('data-cat') || '';
      apply();
    });
  });
})();
