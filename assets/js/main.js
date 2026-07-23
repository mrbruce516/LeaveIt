jQuery(function($) {

    'use strict';

    var _Blog = window._Blog || {};

    _Blog.externalUrl = function() {
        $.expr[':'].external = function(obj) {
            return !obj.href.match(/^mailto\:/) &&
                (obj.hostname != location.hostname);
        };
        $('a:external').addClass('external');
        $(".external").attr('target', '_blank');

    }

    _Blog.changeTitle = function() {
        var currentTitle = document.title;
        window.onblur = function() {
            document.title = 'MAJI';
        }
        window.onfocus = function() {
            document.title = currentTitle;
        }
    };

    _Blog.toggleTheme = function() {
        const currentTheme = window.localStorage && window.localStorage.getItem('theme')
        // localStorage 已设则用用户选择；未设则跟随系统深色偏好，
        // 否则系统深色时 body 无 .dark-theme，深色规则不命中而 media.scss 旧深色背景生效，造成撕裂
        const isDark = currentTheme === 'dark' ||
            (!currentTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        $('body').toggleClass('dark-theme', isDark)
        $('.theme-switch').on('click', () => {
            $('body').toggleClass('dark-theme')
            window.localStorage &&
                window.localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light', )
        })
    }

    _Blog.toggleMobileMenu = function() {
        $('.menu-toggle').on('click', () => {
            $('.menu-toggle').toggleClass('active')
            $('#mobile-menu').toggleClass('active')
        })
    }

    // 代码块复制按钮：复制排除行号的纯代码，反馈 1.5 秒
    _Blog.copyCode = function() {
        $('.copy-code-btn').on('click', function() {
            // clone 后移除行号 .ln，取纯代码文本，避免复制带行号
            var code = $(this).siblings('.highlight').find('code').clone();
            code.find('.ln').remove();
            var text = code.text();
            var btn = this;
            // clipboard 在非安全上下文或被禁用时可能不可用，显式捕获失败给按钮反馈
            if (!navigator.clipboard) {
                btn.textContent = '复制失败';
                setTimeout(function() { btn.textContent = '复制'; }, 1500);
                return;
            }
            navigator.clipboard.writeText(text).then(function() {
                btn.textContent = '已复制 ✓';
                setTimeout(function() { btn.textContent = '复制'; }, 1500);
            }).catch(function() {
                btn.textContent = '复制失败';
                setTimeout(function() { btn.textContent = '复制'; }, 1500);
            });
        });
    };

    $(document).ready(function() {
        _Blog.changeTitle()
        _Blog.toggleTheme()
        _Blog.toggleMobileMenu()
        _Blog.copyCode()
    });
});
