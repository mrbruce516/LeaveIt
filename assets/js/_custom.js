// ==============================
// Custom JavaScript
// ==============================
// 顶部阅读进度条
$(document).ready(function () {
    $(window).scroll(function () {
        $(".top-scroll-bar").attr("style", "width: " + ($(this).scrollTop() / ($(document).height() - $(this).height()) * 100) + "%; display: block;");
    });
});

// TOC 滚动高亮 + 自动折叠：监听正文标题，高亮当前章节并展开其祖先链
$(document).ready(function () {
    var $tocLinks = $('#TableOfContents a[href^="#"]');
    if ($tocLinks.length === 0) return; // 文章无标题则跳过

    // 不支持 IntersectionObserver 时降级：目录可用但不自动高亮折叠
    if (!('IntersectionObserver' in window)) return;

    // 收集标题元素，建立 标题 -> 对应目录链接 的映射
    var headings = [];
    $tocLinks.each(function () {
        var id = decodeURIComponent(this.getAttribute('href').slice(1));
        var el = document.getElementById(id);
        if (el) headings.push({ el: el, link: this });
    });
    if (headings.length === 0) return;

    // 记录最近一次高亮项，避免重复 DOM 操作
    var currentLink = null;

    function setActive(link) {
        if (link === currentLink) return;
        currentLink = link;

        // 清理旧状态
        $('#TableOfContents a.active').removeClass('active');
        $('#TableOfContents li.has-active').removeClass('has-active');

        // 当前项高亮，并给所有祖先 <li> 加 has-active 以展开折叠链
        $(link).addClass('active');
        $(link).parents('li').addClass('has-active');
    }

    // 触发线压在视口约 1/3 处：标题越过该线即回调
    var observer = new IntersectionObserver(function () {
        var topLine = window.innerHeight / 3;
        var best = null;
        // 在全部标题中找「最后一个已越过触发线的」作为当前项，
        // 保证多标题同屏时选中最贴近视口顶部那个
        for (var i = 0; i < headings.length; i++) {
            var rect = headings[i].el.getBoundingClientRect();
            if (rect.top <= topLine) {
                best = headings[i].link;
            }
        }
        if (!best) best = headings[0].link; // 滚到最顶部时高亮第一项
        if (best) setActive(best);
    }, {
        rootMargin: '-33% 0px -60% 0px', // 标题进入视口上 1/3 区域时回调
        threshold: 0
    });

    headings.forEach(function (h) { observer.observe(h.el); });
});