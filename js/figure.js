/* A small shared stepper. Each chapter owns its frames and SVG rendering. */
(function () {
  'use strict';
  window.FigureStepper = function (options) {
    var root = document.querySelector(options.root);
    var previous = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var reset = root.querySelector('[data-reset]');
    var caption = root.querySelector('[data-caption]');
    var count = root.querySelector('[data-count]');
    var index = 0;
    var frames = options.frames;
    function show() {
      options.draw(frames[index], index);
      caption.textContent = frames[index].caption;
      count.textContent = (index + 1) + ' / ' + frames.length;
      previous.disabled = index === 0;
      next.disabled = index === frames.length - 1;
    }
    previous.addEventListener('click', function () { if (index > 0) { index--; show(); } });
    next.addEventListener('click', function () { if (index < frames.length - 1) { index++; show(); } });
    reset.addEventListener('click', function () { index = 0; show(); });
    document.addEventListener('keydown', function (event) {
      if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (event.key === 'ArrowRight' && index < frames.length - 1) { event.preventDefault(); index++; show(); }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); index--; show(); }
    });
    show();
  };
}());
