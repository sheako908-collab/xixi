/* app.js — 模式路由：默认孩子端；首页角落"家长"→PIN→家长端 */
(function () {
  var PIN_LEN = 4;

  /* ---------- 可见高度修正：防止浏览器底部工具栏遮挡键盘 ---------- */
  function setAppH() {
    var vv = window.visualViewport;
    var h = Math.round((vv && vv.height) || window.innerHeight);
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  setAppH();
  window.addEventListener('resize', setAppH);
  window.addEventListener('pageshow', setAppH);
  window.addEventListener('orientationchange', function () { setTimeout(setAppH, 200); });
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', setAppH); }

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- 家长 PIN 页 ---------- */
  function renderPin() {
    var app = window.App.el;
    var pin = '';
    app.innerHTML =
      '<div class="pin-wrap">' +
        '<div class="pin-title">家长验证</div>' +
        '<div class="pin-sub">请输入 4 位 PIN，进入家长端</div>' +
        '<div class="pin-dots" id="pinDots"><span></span><span></span><span></span><span></span></div>' +
        '<div class="pin-err" id="pinErr"></div>' +
        '<div class="pin-pad" id="pinPad">' +
          '<button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>' +
          '<button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>' +
          '<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>' +
          '<button data-k=""></button><button data-k="0">0</button><button data-k="back">⌫</button>' +
        '</div>' +
        '<button class="pin-back" id="pinBack">← 返回孩子端</button>' +
      '</div>';

    var dots = document.getElementById('pinDots').children;
    function draw() {
      for (var i = 0; i < dots.length; i++) {
        dots[i].className = i < pin.length ? 'on' : '';
      }
    }
    function fail(msg) {
      var err = document.getElementById('pinErr');
      err.textContent = msg;
      var d = document.getElementById('pinDots');
      d.classList.remove('err');
      void d.offsetWidth;
      d.classList.add('err');
      pin = '';
      draw();
    }
    document.getElementById('pinPad').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) { return; }
      var k = b.getAttribute('data-k');
      document.getElementById('pinErr').textContent = '';
      if (k === 'back') { pin = pin.slice(0, -1); draw(); return; }
      if (k === '') { return; }
      if (pin.length >= PIN_LEN) { return; }
      pin += k;
      draw();
      if (pin.length === PIN_LEN) { submit(); }
    });
    document.getElementById('pinBack').addEventListener('click', function () {
      window.App.go('home');
    });

    function submit() {
      var p = pin;
      window.API.post('/api/auth', { pin: p }).then(function (res) {
        if (res && res.ok && res.role === 'parent') {
          if (window.Parent && window.Parent.render) {
            window.Parent.render();
          } else {
            fail('家长端还没准备好，稍后再试');
          }
        } else {
          fail('PIN 不对，再想想');
        }
      }, function () {
        fail('网络开小差了，再试一次');
      });
    }
  }

  /* ---------- 路由 ---------- */
  window.App = {
    el: null,
    params: {},
    boot: function () {
      this.el = document.getElementById('app');
      var self = this;
      window.API.boot().then(function () { self.go('home'); }, function () { self.go('home'); });
    },
    go: function (name, params) {
      this.params = params || {};
      if (name === 'pin') { renderPin(); return; }
      if (window.Child && window.Child.renderPage) {
        window.Child.renderPage(name, this.params);
        return;
      }
      if (window.Child) { window.Child.render(); }
    }
  };
})();
